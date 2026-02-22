/// <reference types="node" />
import { Logger } from 'homebridge';
import { AirtouchAPI, AcAbility, AcStatus, ZoneStatus } from './api';
import { AirTouchZoneAccessory } from './platformZoneAccessory';
import { AirTouchACAccessory } from './platformACAccessory';
import { EventEmitter } from 'events';
import { AirtouchPlatform } from './platform';
/**
 * Represents an Air Conditioning unit within the AirTouch 5 system.
 * Maps to the AC ability (0xFF 0x11) and AC status (0x23) protocol messages.
 */
export interface AC {
    ac_number: number;
    ac_ability: AcAbility;
    ac_status?: AcStatus;
    registered: boolean;
    ac_accessory?: AirTouchACAccessory;
}
/**
 * Represents a Zone within the AirTouch 5 system.
 * Maps to zone status (0x21) and zone control (0x20) protocol messages.
 */
export interface Zone {
    zone_number: number;
    ac_number: number;
    zone_name: string;
    zone_status?: ZoneStatus;
    registered: boolean;
    zone_accessory?: AirTouchZoneAccessory;
}
/**
 * AirTouch 5 Wrapper Class
 *
 * This class wraps the AirTouch 5 communication protocol and manages the hierarchical
 * structure: Controller -> AC Units -> Zones
 *
 * Protocol Communication:
 * - TCP connection on port 9005
 * - Message format: Header(4) + Address(2) + MsgID(1) + Type(1) + DataLen(2) + Data + CRC(2)
 * - Control messages (0xC0): Zone control (0x20), Zone status (0x21), AC control (0x22), AC status (0x23)
 * - Extended messages (0x1F): AC ability (0xFF 0x11), Zone names (0xFF 0x13), etc.
 */
export declare class Airtouch5Wrapper {
    ip: string;
    consoleId: string;
    AirtouchId: string;
    deviceName: string;
    platform: AirtouchPlatform;
    api: AirtouchAPI;
    log: Logger;
    emitter: EventEmitter;
    acs: Array<AC>;
    zones: Array<Zone>;
    constructor(ip: string, consoleId: string, AirtouchId: string, deviceName: string, log: Logger, emitter: EventEmitter, platform: AirtouchPlatform);
    /**
     * Process AC Ability message (Extended message 0xFF 0x11)
     *
     * This handles the response from requesting AC capabilities, which includes:
     * - AC name (16 bytes)
     * - Start zone number and zone count
     * - Supported modes (auto, cool, heat, dry, fan)
     * - Supported fan speeds (auto, quiet, low, medium, high, powerful, turbo, intelligent)
     * - Temperature ranges for heating and cooling
     *
     * @param ac_ability - AC capability data from protocol message
     */
    AddAcAbility(ac_ability: AcAbility): void;
    /**
     * Initialize zones for a specific AC unit based on its ability data.
     *
     * Each AC unit controls a contiguous range of zones as specified in the AC ability:
     * - ac_start_zone: First zone number controlled by this AC
     * - ac_zone_count: Number of zones controlled by this AC
     *
     * @param ac_number - AC unit number (0-7)
     * @param ac_ability - AC capability data containing zone mapping
     */
    initialiseZonesForAc(ac_number: number, ac_ability: AcAbility): void;
    /**
     * Process Zone Status message (0x21)
     *
     * Handles zone status updates containing:
     * - Power state (Off=0, On=1, Turbo=3)
     * - Control method (Temperature=1, Percentage=0)
     * - Current and target temperatures
     * - Damper position percentage
     * - Sensor presence and temperature readings
     * - Battery and spill status
     *
     * @param zone_status - Zone status data from protocol message
     */
    AddUpdateZoneStatus(zone_status: ZoneStatus): void;
    /**
     * Process Zone Name message (Extended message 0xFF 0x13)
     *
     * Updates zone names received from the AirTouch system.
     * Zone names are typically 16 bytes max, null-terminated if shorter.
     *
     * @param in_zone_number - Zone number (0-15)
     * @param zone_name - Human-readable zone name
     */
    AddZoneName(in_zone_number: number, zone_name: string): void;
    /**
     * Attempt to reconnect to the AirTouch 5 system.
     * Called when the TCP connection is lost or encounters errors.
     */
    AttemptReconnect(): void;
    /**
     * Process AC Status message (0x23)
     *
     * Handles AC status updates containing:
     * - Power state (Off=0, On=1, Away(Off)=2, Away(On)=3, Sleep=5)
     * - Mode (auto=0, heat=1, dry=2, fan=3, cool=4, auto heat=8, auto cool=9)
     * - Fan speed (auto=0, quiet=1, low=2, med=3, high=4, powerful=5, turbo=6, intelligent=9-14)
     * - Current and target temperatures
     * - Status flags (turbo, bypass, spill, timer)
     * - Error codes
     *
     * @param ac_status - AC status data from protocol message
     */
    AddUpdateAcStatus(ac_status: AcStatus): void;
    /**
     * Create a new AC unit from ability data.
     *
     * Logs comprehensive AC configuration including:
     * - Name and zone assignment
     * - Available modes and fan speeds
     * - Temperature ranges for heating and cooling
     *
     * @param ac_number - AC unit number (0-7)
     * @param ac_ability - AC capability data
     */
    createAc(ac_number: number, ac_ability: AcAbility): void;
    /**
     * Create a new zone with default settings.
     * Zone will be registered with HomeKit once we receive its name and status.
     *
     * @param zone_number - Zone number (0-15)
     * @param ac_number - Parent AC unit number
     */
    createZone(zone_number: number, ac_number: number): void;
    /**
     * Register a zone with HomeKit.
     *
     * Creates or retrieves the platform accessory and wraps it with our zone accessory class.
     * This enables control through HomeKit and updates from the AirTouch system.
     *
     * @param zone_number - Zone number to register
     * @param ac_number - Parent AC unit number
     */
    registerZone(zone_number: number, ac_number: number): void;
    /**
     * Register an AC unit with HomeKit.
     *
     * Creates or retrieves the platform accessory and wraps it with our AC accessory class.
     * This enables control through HomeKit and updates from the AirTouch system.
     *
     * @param ac_number - AC unit number to register
     */
    registerAc(ac_number: number): void;
    /**
     * Extract available modes from AC ability flags.
     * Maps protocol bit flags to human-readable mode names.
     *
     * @param ac_ability - AC capability data
     * @returns Array of supported mode names
     */
    private getAvailableModes;
    /**
     * Extract available fan speeds from AC ability flags.
     * Maps protocol bit flags to human-readable fan speed names.
     *
     * @param ac_ability - AC capability data
     * @returns Array of supported fan speed names
     */
    private getAvailableFanSpeeds;
    /**
     * Format temperature value for display.
     * Handles protocol temperature encoding and invalid values.
     *
     * @param temp - Raw temperature value from protocol
     * @returns Formatted temperature string
     */
    private formatTemperature;
    /**
     * Convert zone power state code to human-readable string.
     * Maps protocol power state values to descriptive text.
     *
     * @param zone_status - Zone status containing power state
     * @returns Human-readable power state
     */
    private getZonePowerState;
    /**
     * Convert zone control type flag to human-readable string.
     *
     * @param zone_status - Zone status containing control type flag
     * @returns Control type description
     */
    private getZoneControlType;
    /**
     * Convert zone sensor presence flag to human-readable string.
     *
     * @param zone_status - Zone status containing sensor flag
     * @returns Sensor presence description
     */
    private getZoneSensorStatus;
    /**
     * Convert zone battery status flag to human-readable string.
     *
     * @param zone_status - Zone status containing battery flag
     * @returns Battery status description
     */
    private getZoneBatteryStatus;
    /**
     * Convert zone spill status flag to human-readable string.
     * Spill refers to air overflow when dampers can't close completely.
     *
     * @param zone_status - Zone status containing spill flag
     * @returns Spill status description
     */
    private getZoneSpillStatus;
    /**
     * Format comprehensive zone status for logging.
     * Creates a detailed status string with all relevant zone information.
     *
     * @param zone_status - Complete zone status data
     * @returns Formatted status string for logging
     */
    private formatZoneStatus;
    /**
     * Convert AC power state code to human-readable string.
     * Maps protocol AC power state values to descriptive text.
     *
     * @param ac_status - AC status containing power state
     * @returns Human-readable power state
     */
    private getAcPowerState;
    /**
     * Convert AC mode code to human-readable string.
     * Maps protocol AC mode values to descriptive text.
     *
     * @param ac_status - AC status containing mode
     * @returns Human-readable mode description
     */
    private getAcMode;
    /**
     * Create a concise AC status summary for logging.
     * Provides key AC information in a compact format.
     *
     * @param ac_status - Complete AC status data
     * @returns Formatted status summary
     */
    private getAcStatusSummary;
}
//# sourceMappingURL=airTouchWrapper.d.ts.map