/// <reference types="node" />
/// <reference types="node" />
/// <reference types="node" />
/// <reference types="node" />
import { Logger } from 'homebridge';
import * as net from 'net';
import { EventEmitter } from 'events';
/**
 * Interface defining the capabilities and configuration of an AC unit
 * All properties are strings as they come directly from the device protocol
 */
export interface AcAbility {
    ac_unit_number: number;
    ac_name: string;
    ac_start_zone: number;
    ac_zone_count: number;
    ac_support_cool_mode: number;
    ac_support_fan_mode: number;
    ac_support_dry_mode: number;
    ac_support_heat_mode: number;
    ac_support_auto_mode: number;
    ac_support_fan_intelligent: number;
    ac_support_fan_turbo: number;
    ac_support_fan_powerful: number;
    ac_support_fan_high: number;
    ac_support_fan_medium: number;
    ac_support_fan_low: number;
    ac_support_fan_quiet: number;
    ac_support_fan_auto: number;
    ac_min_cool: number;
    ac_max_cool: number;
    ac_min_heat: number;
    ac_max_heat: number;
}
/**
 * Interface defining the current status of an AC unit
 * All properties are strings as they come directly from the device protocol
 */
export interface AcStatus {
    ac_unit_number: number;
    ac_power_state: number;
    ac_mode: number;
    ac_fan_speed: number;
    ac_target: number;
    ac_temp: number;
    ac_turbo: number;
    ac_bypass: number;
    ac_spill: number;
    ac_timer: number;
    ac_error_code: number;
}
/**
 * Interface for zone control parameters used in encode_zone_control()
 * Based on AirTouch 5 Protocol Specification Section 4.a.i (Zone control 0x20)
 */
export interface ZoneControlUnit {
    /**
     * Zone number (0-15)
     * Maps to Byte1 in protocol
     * Valid values: 0x00 – 0x0F (0-15)
     */
    zone_number?: number;
    /**
     * Zone power control
     * Maps to Byte2 bits 1-3 in protocol
     * Values from MAGIC.ZONE_POWER_STATES:
     * - 001: Change on/off state
     * - 010: Set to off
     * - 011: Set to on
     * - 101: Set to turbo
     * - Other: Keep power state
     */
    zone_power_state?: number;
    /**
     * Zone setting/target control type
     * Maps to Byte2 bits 6-8 in protocol
     * Values from MAGIC.ZONE_TARGET_TYPES:
     * - 010: Value decrease (-1°C/-5%)
     * - 011: Value increase (+1°C/+5%)
     * - 100: Set open percentage (0-100)
     * - 101: Set target setpoint (temperature)
     * - Other: Keep setting value
     */
    zone_target_type?: number;
    /**
     * Target value to set
     * Maps to Byte3 in protocol
     *
     * When setting percentage: 0-100 (damper opening percentage)
     * When setting temperature: 0-250, where setpoint = (value+100)/10 °C
     *
     * Examples:
     * - For 50% damper: zone_target = 50
     * - For 22°C: zone_target = (22*10)-100 = 120
     *
     * Other: Keep setting value (ignored)
     */
    zone_target?: number;
}
/**
 * Interface for AC control unit parameters used in encode_ac_control()
 * Based on AirTouch 5 Protocol Specification Section 4.a.iii (AC control 0x22)
 */
export interface AcControlUnit {
    /**
     * AC unit number (0-7)
     * Maps to Byte1 bits 1-4 in protocol
     */
    ac_unit_number?: number;
    /**
     * Power state control
     * Maps to Byte1 bits 5-8 in protocol
     * Values from MAGIC.AC_POWER_STATES:
     * - 0001: Change on/off status
     * - 0010: Set to off
     * - 0011: Set to on
     * - 0100: Set to away
     * - 0101: Set to sleep
     * - Other: Keep power setting
     */
    ac_power_state?: number;
    /**
     * Fan speed setting
     * Maps to Byte2 bits 1-4 in protocol
     * Values from MAGIC.AC_FAN_SPEEDS:
     * - 0000: Set to auto
     * - 0001: Set to quiet
     * - 0010: Set to low
     * - 0011: Set to medium
     * - 0100: Set to high
     * - 0101: Set to powerful
     * - 0110: Set to turbo
     * - 1000: Set to Intelligent Auto
     * - Other: Keep fan speed setting
     */
    ac_fan_speed?: number;
    /**
     * AC operating mode
     * Maps to Byte2 bits 5-8 in protocol
     * Values from MAGIC.AC_MODES:
     * - 0000: Set to auto
     * - 0001: Set to heat
     * - 0010: Set to dry
     * - 0011: Set to fan
     * - 0100: Set to cool
     * - Other: Keep mode setting
     */
    ac_mode?: number;
    /**
     * Target temperature control type
     * Maps to Byte3 in protocol (upper 4 bits only)
     * Values from MAGIC.AC_TARGET_TYPES:
     * - 0x40: Change setpoint
     * - 0x00: Keep setpoint value
     * - Other: Invalidate data
     */
    ac_target_keep?: number;
    /**
     * Target temperature value (protocol format)
     * Maps to Byte4 in protocol
     * Only used when ac_target_keep is 0x40
     *
     * Formula: protocol_value = (celsius_temp * 10) - 100
     * Example: For 22°C: (22 * 10) - 100 = 120
     * Controller converts back: (120 + 100) / 10 = 22°C
     *
     * Valid range: 10.0°C to 35.0°C (protocol values: 0 to 250)
     */
    ac_target_value?: number;
}
/**
 * Interface defining the current status of a zone
 * All properties are strings as they come directly from the device protocol
 */
export interface ZoneStatus {
    zone_number: number;
    zone_name: string;
    zone_power_state: number;
    zone_control_type: number;
    zone_damper_position: number;
    zone_target: number;
    zone_temp: number;
    zone_battery_low: number;
    zone_has_sensor: number;
    zone_has_spill: number;
}
/**
 * Main API class for communicating with AirTouch 5 controller
 * Handles TCP connection, message encoding/decoding, and device discovery
 */
export declare class AirtouchAPI {
    log: Logger;
    device: net.Socket;
    emitter: EventEmitter;
    lastDataTime: number;
    got_ac_ability: boolean;
    got_zone_status: boolean;
    readonly ip: string;
    readonly consoleId: string;
    readonly AirtouchId: string;
    readonly deviceName: string;
    /**
     * TCP socket client for the Airtouch Touchpad Controller
     * Listens and decodes broadcast messages containing AC and Group states
     * Encodes and sends messages containing AC and Group commands
     */
    constructor(ip: string, consoleId: string, AirtouchId: string, deviceName: string, log: Logger, emitter: EventEmitter);
    /**
     * Static method to discover AirTouch devices on the network via UDP broadcast
     * Sends discovery request and listens for responses containing device information
     * @param log - Logger instance for debug output
     * @param myemitter - EventEmitter to notify when devices are found
     */
    static discoverDevices(log: Logger, myemitter: EventEmitter): Promise<void>;
    /**
     * Calculate CRC16 checksum for message validation
     * Uses Modbus CRC16 algorithm as required by AirTouch protocol
     * Implementation from https://github.com/yuanxu2017/modbus-crc16
     * @param buffer - Data buffer to calculate checksum for
     * @returns CRC16 checksum value
     */
    crc16(buffer: Buffer): number;
    /**
     * Utility function to provide default values for undefined parameters
     * Uses TypeScript generics for type safety while maintaining flexibility
     * @param val - Value to check (can be undefined)
     * @param nullVal - Default value to return if val is undefined
     * @returns val if defined, nullVal otherwise
     */
    isNull<T>(val: T | undefined, nullVal: T): T;
    /**
     * Log AcControlUnit interface data in a clean, single-line format
     * @param control - AcControlUnit object to log
     * @returns Formatted string for logging
     */
    logAcControlUnit(control: AcControlUnit): string;
    /**
     * Log ZoneControlUnit interface data in a clean, single-line format
     * @param control - ZoneControlUnit object to log
     * @returns Formatted string for logging
     */
    logZoneControlUnit(control: ZoneControlUnit): string;
    /**
     * Assemble an extended message packet for complex requests
     * Extended messages are used for getting AC abilities and zone names
     * @param data - Command data to include in message
     * @returns Complete message buffer ready for transmission
     */
    assemble_extended_message(data: Buffer): Buffer;
    /**
     * Assemble a standard message packet for regular commands
     * Standard messages are used for status requests and control commands
     * @param type - Message type identifier
     * @param data - Command data to include in message
     * @returns Complete message buffer ready for transmission
     */
    assemble_standard_message(type: number, data: Buffer): Buffer;
    /**
     * Decode extended message responses from AirTouch controller
     * Extended messages contain AC abilities, errors, and zone names
     * @param data - Raw message data from controller
     */
    decode_extended_message(data: Buffer): void;
    /**
     * Decode standard message responses from AirTouch controller
     * Standard messages contain AC status and zone status information
     * @param data - Raw message data from controller
     */
    decode_standard_message(data: Buffer): void;
    /**
     * Send a message to the AirTouch controller via TCP
     * Adds protocol header and CRC checksum before transmission
     * @param data - Message data to send (without header/checksum)
     */
    send(data: Buffer): void;
    /**
     * ENCODE AC CONTROL - Based on AirTouch 5 Protocol Specification (Section 4.a.iii)
     *
     * This method implements the exact AC control message format specified in the
     * AirTouch 5 Communication Protocol document (page 8-9).
     *
     * PROTOCOL CONTEXT:
     * - Message Type: 0xC0 (Control command and status message)
     * - Sub Type: 0x22 (AC control)
     * - Each repeat data: 4 bytes per AC unit
     * - This method creates those 4 bytes of repeat data
     *
     * THE 4-BYTE AC CONTROL FORMAT (from protocol spec):
     * ┌─────────┬─────────────────────────────────────────────────────────────┐
     * │ Byte 1  │ Bit8-5: Power setting    │ Bit4-1: AC number (0-7)        │
     * ├─────────┼─────────────────────────────────────────────────────────────┤
     * │ Byte 2  │ Bit8-5: AC mode          │ Bit4-1: AC fan speed           │
     * ├─────────┼─────────────────────────────────────────────────────────────┤
     * │ Byte 3  │ Setpoint control (0x40=change, 0x00=keep)                  │
     * ├─────────┼─────────────────────────────────────────────────────────────┤
     * │ Byte 4  │ Setpoint value (when Byte3=0x40): (data+100)/10 = °C      │
     * └─────────┴─────────────────────────────────────────────────────────────┘
     */
    encode_ac_control(unit: AcControlUnit): Buffer;
    /**
     * Send command to turn AC unit on or off
     * @param unit_number - AC unit identifier (0-15)
     * @param active - true to turn on, false to turn off
     */
    acSetActive(unit_number: number, active: boolean): void;
    /**
     * Send command to change AC target temperature
     * @param unit_number - AC unit identifier (0-15)
     * @param value - Target temperature in Celsius
     */
    acSetTargetTemperature(unit_number: number, value: number): void;
    /**
     * Send command to change AC heating/cooling mode
     * @param unit_number - AC unit identifier (0-7)
     * @param state - Target state (OFF/HEAT/COOL/AUTO)
     */
    acSetTargetHeatingCoolingState(unit_number: number, state: number): void;
    /**
     * Send command to change AC fan speed
     * @param unit_number - AC unit identifier (0-15)
     * @param speed - Fan speed setting (0=auto, 1=quiet, 2=low, etc.)
     */
    acSetFanSpeed(unit_number: number, speed: number): void;
    /**
     * Decode zone name information from extended message
     * Zone names are variable length and packed sequentially in the message
     * @param data - Raw zone name data from controller
     */
    decode_zone_names(data: Buffer): void;
    /**
     * Decode AC ability/capability information from extended message
     * Contains AC configuration, supported modes, temperature ranges, etc.
     * @param data - Raw AC ability data from controller
     */
    decode_ac_ability(data: Buffer): void;
    /**
     * Decode AC status information from standard message
     * Contains current AC operating state, temperatures, settings, etc.
     * @param count_repeats - Number of AC units in message
     * @param data_length - Length of each AC record (8 bytes)
     * @param data - Raw AC status data
     */
    decode_ac_status(count_repeats: number, data_length: number, data: Buffer): void;
    /**
     * Decode zone status information from standard message
     * Contains current zone operating state, temperatures, damper positions, etc.
     * @param count_repeats - Number of zones in message
     * @param data_length - Length of each zone record (8 bytes)
     * @param data - Raw zone status data
     */
    decode_zones_status(count_repeats: number, data_length: number, data: Buffer): void;
    /**
     * Encode zone control parameters into protocol format
     * Packs zone control parameters into 4-byte message format according to
     * AirTouch 5 Protocol Specification Section 4.a.i (Zone control 0x20)
     *
     * PROTOCOL FORMAT:
     * ┌─────────┬─────────────────────────────────────────────────────────────┐
     * │ Byte 1  │ Zone number (0-15)                                          │
     * ├─────────┼─────────────────────────────────────────────────────────────┤
     * │ Byte 2  │ Bit8-6: Zone setting    │ Bit5-4: Keep0  │ Bit3-1: Power │
     * ├─────────┼─────────────────────────────────────────────────────────────┤
     * │ Byte 3  │ Value to Set (0-100 for %, 0-250 for temp)                 │
     * ├─────────┼─────────────────────────────────────────────────────────────┤
     * │ Byte 4  │ Keep 0 (Reserved)                                           │
     * └─────────┴─────────────────────────────────────────────────────────────┘
     *
     * @param zone - Object containing zone control parameters
     * @returns Encoded 4-byte control message
     */
    encode_zone_control(zone: ZoneControlUnit): Buffer;
    /**
     * Send command to turn zone on or off
     * @param zone_number - Zone identifier (0-15)
     * @param active - true to turn on, false to turn off
     */
    zoneSetActive(zone_number: number, active: boolean): void;
    /**
     * Send command to change zone damper percentage
     * @param zone_number - Zone identifier (0-15)
     * @param value - Damper opening percentage (0-100)
     */
    zoneSetPercentage(zone_number: number, value: number): void;
    /**
     * Send command to set zone target temperature
     * @param zone_number - Zone identifier (0-15)
     * @param temp - Target temperature in Celsius
     */
    zoneSetTargetTemperature(zone_number: number, temp: number): void;
    /**
     * Request current AC status from controller
     * Only sends request if AC abilities have been received first
     */
    GET_AC_STATUS(): void;
    /**
     * Request AC abilities/capabilities from controller
     * This is typically the first request sent after connection
     */
    GET_AC_ABILITY(): void;
    /**
     * Request current zone status from controller
     * Sends request with dummy data due to protocol requirement
     */
    GET_ZONE_STATUS(): void;
    /**
     * Request zone names from controller
     * Only sends request if zone status has been received first
     */
    GET_ZONE_NAMES(): void;
    /**
     * Monitor connection health by checking last received data timestamp
     * Triggers reconnection if no data received for 2 minutes
     */
    checkLastDateReceived(): void;
    /**
     * Establish TCP connection to AirTouch controller
     * Sets up event handlers for data, error, and connection events
     */
    connect(): void;
}
//# sourceMappingURL=api.d.ts.map