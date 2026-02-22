/**
 * AIRTOUCH 5 HOMEBRIDGE PLATFORM
 *
 * This is the main platform class that acts as the central coordinator for the
 * AirTouch 5 Homebridge plugin. It implements Homebridge's DynamicPlatformPlugin
 * interface to manage AC units and zones as HomeKit accessories.
 *
 * RESPONSIBILITIES:
 * 1. Device Discovery: Find AirTouch controllers on the network
 * 2. Device Management: Track multiple AirTouch devices
 * 3. Accessory Lifecycle: Create, update, and remove HomeKit accessories
 * 4. Event Coordination: Route status updates between devices and accessories
 * 5. Configuration: Handle user settings and cached accessories
 *
 * ARCHITECTURE OVERVIEW:
 * Platform (this class) → Wrapper (device manager) → API (protocol handler)
 *     ↓                       ↓                        ↓
 * Accessories            AC/Zone Status            TCP Communication
 * (HomeKit)              (State Updates)           (AirTouch Protocol)
 */
/// <reference types="node" />
import { API, DynamicPlatformPlugin, Logger, PlatformConfig, Service, Characteristic, PlatformAccessory } from 'homebridge';
import { EventEmitter } from 'events';
import { Airtouch5Wrapper } from './airTouchWrapper';
/**
 * Context data stored with each HomeKit accessory for identification
 * This helps us route status updates to the correct accessory instance
 */
interface AccessoryContext {
    zone_number?: number;
    ac_number?: number;
    AirtouchId?: string;
    zone_or_ac?: string;
}
/**
 * MAIN PLATFORM CLASS
 *
 * Implements Homebridge's DynamicPlatformPlugin interface to provide:
 * - Dynamic accessory creation based on discovered devices
 * - Persistent accessory storage across Homebridge restarts
 * - Event-driven updates when device status changes
 */
export declare class AirtouchPlatform implements DynamicPlatformPlugin {
    readonly log: Logger;
    readonly config: PlatformConfig;
    readonly api: API;
    readonly Service: typeof Service;
    readonly Characteristic: typeof Characteristic;
    emitter: EventEmitter;
    airtouch_devices: Array<Airtouch5Wrapper>;
    accessories: Array<PlatformAccessory>;
    /**
     * PLATFORM CONSTRUCTOR
     *
     * Called by Homebridge when creating the platform instance.
     * Sets up the foundational infrastructure before device discovery.
     *
     * INITIALIZATION SEQUENCE:
     * 1. Initialize collections and event system
     * 2. Set up event listeners for device communication
     * 3. Register for Homebridge lifecycle events
     * 4. Prepare for device discovery after Homebridge finishes launching
     */
    constructor(log: Logger, // Homebridge logging interface
    config: PlatformConfig, // User configuration from config.json
    api: API);
    /**
     * DEVICE DISCOVERY ORCHESTRATION
     *
     * Handles two discovery modes:
     * 1. Manual Configuration: User specifies device IPs in config.json
     * 2. Automatic Discovery: Broadcast UDP packets to find devices on network
     *
     * DISCOVERY PROCESS:
     * Manual → Read IPs from config → Create device wrappers
     * Auto → Send UDP broadcast → Listen for responses → Create device wrappers
     */
    discoverDevices(): void;
    /**
     * DEVICE WRAPPER CREATION
     *
     * Creates and manages Airtouch5Wrapper instances for each physical device.
     * Each wrapper handles communication with one AirTouch controller and manages
     * all AC units and zones connected to that controller.
     *
     * DEDUPLICATION: Prevents creating multiple wrappers for the same device
     * by checking AirtouchId (unique device identifier)
     */
    addAirtouchDevice(in_ip: string, consoleId: string, in_AirtouchId: string, deviceName: string): void;
    /**
     * AC STATUS EVENT HANDLER
     * Routes AC status updates to the appropriate device wrapper
     */
    onACStatusNotification(ac_status: any, in_AirtouchId: any): void;
    /**
     * ZONE STATUS EVENT HANDLER
     * Routes zone status updates to the appropriate device wrapper
     */
    onZoneStatusNotification(zone_status: any, in_AirtouchId: any): void;
    /**
     * ZONE NAME EVENT HANDLER
     * Routes zone name updates to the appropriate device wrapper
     */
    onZoneNameNotification(zone_number: any, zone_name: any, in_AirtouchId: any): void;
    /**
     * RECONNECTION EVENT HANDLER
     * Triggers reconnection attempt for specific device
     */
    onAttemptReconnect(in_AirtouchId: any): void;
    /**
     * AC CAPABILITY EVENT HANDLER
     * Routes AC capability information to the appropriate device wrapper
     */
    onACAbilityNotification(ac_ability: any, in_AirtouchId: any): void;
    /**
     * CACHED ACCESSORY CONFIGURATION
     *
     * Called by Homebridge during startup for each cached accessory.
     * Cached accessories are ones that were created in previous sessions
     * and are being restored from Homebridge's persistent storage.
     *
     * We store these in our accessories array so we can:
     * 1. Reuse existing accessories instead of creating duplicates
     * 2. Clean up accessories that are no longer valid
     * 3. Update existing accessories with new device status
     */
    configureAccessory(accessory: PlatformAccessory<AccessoryContext>): void;
    /**
     * ACCESSORY LOOKUP UTILITY
     *
     * Finds a specific accessory by matching its context data.
     * Used to locate existing accessories when updating status or
     * checking if an accessory already exists before creating a new one.
     *
     * MATCHING CRITERIA:
     * 1. AirtouchId must match (identifies the physical controller)
     * 2. AC number must match (identifies the AC unit)
     * 3. Type (AC/ZONE) must match
     * 4. For zones: zone number must also match
     *
     * @param AirtouchId - Unique device identifier
     * @param ac_number - AC unit number (0-7)
     * @param zone_or_ac - Type: 'AC' or 'ZONE'
     * @param zone_number - Zone number (0-15, required for zones)
     * @returns Found accessory or undefined
     */
    findAccessory(AirtouchId: string, ac_number: number, zone_or_ac: string, zone_number?: number): PlatformAccessory | undefined;
}
export {};
/**
 * PLUGIN ARCHITECTURE SUMMARY:
 *
 * CONFIG.JSON → Platform Constructor → Device Discovery → Wrapper Creation →
 * API Connection → Status Events → Accessory Updates → HomeKit Integration
 *
 * DATA FLOW:
 * 1. User configures platform in config.json
 * 2. Homebridge creates platform instance
 * 3. Platform discovers AirTouch devices
 * 4. Platform creates wrapper for each device
 * 5. Wrapper creates API connection to device
 * 6. API receives status updates via TCP
 * 7. API emits events to platform
 * 8. Platform routes events to appropriate wrapper
 * 9. Wrapper updates corresponding accessories
 * 10. Accessories reflect changes in HomeKit
 *
 * ERROR HANDLING:
 * - Device discovery failures are logged but don't stop the platform
 * - Connection failures trigger automatic reconnection attempts
 * - Invalid accessories are cleaned up during startup
 * - Missing devices are handled gracefully
 */ 
//# sourceMappingURL=platform.d.ts.map