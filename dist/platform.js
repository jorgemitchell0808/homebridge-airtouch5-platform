"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AirtouchPlatform = void 0;
const api_1 = require("./api");
const events_1 = require("events");
const airTouchWrapper_1 = require("./airTouchWrapper");
const settings_1 = require("./settings");
const magic_1 = require("./magic");
/**
 * MAIN PLATFORM CLASS
 *
 * Implements Homebridge's DynamicPlatformPlugin interface to provide:
 * - Dynamic accessory creation based on discovered devices
 * - Persistent accessory storage across Homebridge restarts
 * - Event-driven updates when device status changes
 */
class AirtouchPlatform {
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
    constructor(log, // Homebridge logging interface
    config, // User configuration from config.json
    api) {
        this.log = log;
        this.config = config;
        this.api = api;
        // Homebridge service and characteristic references for creating accessories
        this.Service = this.api.hap.Service;
        this.Characteristic = this.api.hap.Characteristic;
        // Initialize device and accessory collections
        this.airtouch_devices = new Array();
        this.accessories = new Array();
        this.emitter = new events_1.EventEmitter();
        this.log.debug('PLAT    | Starting to set up Airtouch5 platform.');
        // HOMEBRIDGE LIFECYCLE INTEGRATION
        // Wait for Homebridge to finish loading before discovering devices
        this.api.on('didFinishLaunching', () => {
            this.log.debug('PLAT    | Executed didFinishLaunching callback');
            // ACCESSORY CLEANUP
            // Remove any cached accessories that are missing required context
            // This handles cases where accessories were corrupted or partially created
            for (let i = 0; i < this.accessories.length; i++) {
                let should_unregister = false;
                // Check for missing or invalid context data
                if (this.accessories[i].context === undefined) {
                    should_unregister = true;
                }
                else {
                    if (this.accessories[i].context.zone_or_ac === undefined) {
                        should_unregister = true;
                    }
                }
                // Remove broken accessories from Homebridge
                if (should_unregister === true) {
                    this.api.unregisterPlatformAccessories(settings_1.PLUGIN_NAME, settings_1.PLATFORM_NAME, [this.accessories[i]]);
                    this.log.debug('PLAT    | Unregistering accessory. ' + i);
                }
            }
            // Start device discovery process
            this.discoverDevices();
        });
        // DEVICE EVENT HANDLERS
        // Set up listeners for status updates from AirTouch devices
        // These events are emitted by the API layer when device status changes
        /**
         * AC Status Updates
         * Triggered when AC unit status changes (power, mode, temperature, etc.)
         */
        this.emitter.on('ac_status', (ac_status, in_AirtouchId) => {
            this.onACStatusNotification(ac_status, in_AirtouchId);
        });
        /**
         * Zone Status Updates
         * Triggered when zone status changes (power, damper position, temperature, etc.)
         */
        this.emitter.on('zone_status', (zone_status, in_AirtouchId) => {
            this.onZoneStatusNotification(zone_status, in_AirtouchId);
        });
        /**
         * AC Capability Information
         * Triggered when we learn about an AC's supported modes, fan speeds, etc.
         * Used to configure accessory capabilities in HomeKit
         */
        this.emitter.on('ac_ability', (ac_ability, in_AirtouchId) => {
            this.onACAbilityNotification(ac_ability, in_AirtouchId);
        });
        /**
         * Zone Name Updates
         * Triggered when we receive human-readable zone names from the controller
         * Used to give accessories meaningful names in HomeKit
         */
        this.emitter.on('zone_name', (zone_number, zone_name, in_AirtouchId) => {
            this.onZoneNameNotification(zone_number, zone_name, in_AirtouchId);
        });
        /**
         * Connection Recovery
         * Triggered when a device loses connection and needs to reconnect
         * Handles network interruptions gracefully
         */
        this.emitter.on('attempt_reconnect', (in_AirtouchId) => {
            this.onAttemptReconnect(in_AirtouchId);
        });
    }
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
    discoverDevices() {
        // MANUAL CONFIGURATION MODE
        // If user specified device IPs in config, use those instead of discovery
        if (this.config.units?.length) {
            this.log.debug('PLAT    | Defined units in config, not doing automated discovery');
            // Create a device wrapper for each configured IP
            this.config.units.forEach(ip => this.addAirtouchDevice(ip, 'console-' + ip, 'airtouchid-' + ip, 'device-' + ip));
            return;
        }
        // AUTOMATIC NETWORK DISCOVERY MODE
        // Listen for device discovery responses
        this.emitter.on('found_devices', (ip, consoleId, AirtouchId, deviceName) => {
            this.log.info('PLATFORM| Auto-discovered an AT5 - %s: Console ID: %s, Airtouch ID: %s, IP: %s ', deviceName, consoleId, AirtouchId, ip);
            // Create device wrapper for discovered device
            this.addAirtouchDevice(ip, consoleId, AirtouchId, deviceName);
        });
        // Initiate UDP broadcast discovery
        api_1.AirtouchAPI.discoverDevices(this.log, this.emitter);
    }
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
    addAirtouchDevice(in_ip, consoleId, in_AirtouchId, deviceName) {
        // Check if we already have a wrapper for this device
        const result = this.airtouch_devices.find(({ AirtouchId }) => AirtouchId === in_AirtouchId);
        if (result === undefined) {
            // Create new device wrapper
            const newAirtouch = new airTouchWrapper_1.Airtouch5Wrapper(in_ip, consoleId, in_AirtouchId, deviceName, this.log, this.emitter, this);
            this.airtouch_devices.push(newAirtouch);
        }
        else {
            this.log.error('PLAT    | IP Address already existed in wrapper array, this shouldn\'t happen.', in_ip);
        }
    }
    // ==========================================
    // EVENT HANDLERS - Route updates to devices
    // ==========================================
    /**
     * AC STATUS EVENT HANDLER
     * Routes AC status updates to the appropriate device wrapper
     */
    onACStatusNotification(ac_status, in_AirtouchId) {
        const result = this.airtouch_devices.find(({ AirtouchId }) => AirtouchId === in_AirtouchId);
        if (result === undefined) {
            this.log.debug('PLAT    | Error condition in AC Status, no AirTouch ID found', in_AirtouchId);
        }
        else {
            result.AddUpdateAcStatus(ac_status);
        }
    }
    /**
     * ZONE STATUS EVENT HANDLER
     * Routes zone status updates to the appropriate device wrapper
     */
    onZoneStatusNotification(zone_status, in_AirtouchId) {
        const result = this.airtouch_devices.find(({ AirtouchId }) => AirtouchId === in_AirtouchId);
        if (result === undefined) {
            this.log.debug('PLAT    | Error condition in Zone Status, no AirTouch ID found', in_AirtouchId);
        }
        else {
            result.AddUpdateZoneStatus(zone_status);
        }
    }
    /**
     * ZONE NAME EVENT HANDLER
     * Routes zone name updates to the appropriate device wrapper
     */
    onZoneNameNotification(zone_number, zone_name, in_AirtouchId) {
        const result = this.airtouch_devices.find(({ AirtouchId }) => AirtouchId === in_AirtouchId);
        if (result === undefined) {
            this.log.debug('PLAT    | Error condition in Zone Name, no AirTouch ID found', in_AirtouchId);
        }
        else {
            result.AddZoneName(zone_number, zone_name);
        }
    }
    /**
     * RECONNECTION EVENT HANDLER
     * Triggers reconnection attempt for specific device
     */
    onAttemptReconnect(in_AirtouchId) {
        const result = this.airtouch_devices.find(({ AirtouchId }) => AirtouchId === in_AirtouchId);
        if (result === undefined) {
            this.log.debug('PLAT    | Attempt reconnect message, but no AirTouch ID found', in_AirtouchId);
        }
        else {
            result.AttemptReconnect();
        }
    }
    /**
     * AC CAPABILITY EVENT HANDLER
     * Routes AC capability information to the appropriate device wrapper
     */
    onACAbilityNotification(ac_ability, in_AirtouchId) {
        const result = this.airtouch_devices.find(({ AirtouchId }) => AirtouchId === in_AirtouchId);
        if (result === undefined) {
            this.log.debug('PLAT    | Error condition in AC Ability, no AirTouch ID found', in_AirtouchId);
        }
        else {
            result.AddAcAbility(ac_ability);
        }
    }
    // ===============================================
    // HOMEBRIDGE PLATFORM INTERFACE IMPLEMENTATION
    // ===============================================
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
    configureAccessory(accessory) {
        this.accessories.push(accessory);
    }
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
    findAccessory(AirtouchId, ac_number, zone_or_ac, zone_number) {
        // Search through all cached accessories
        for (let i = 0; i < this.accessories.length; i++) {
            const my_context = this.accessories[i].context;
            // Match by AirtouchId (device)
            if (my_context.AirtouchId !== undefined && my_context.AirtouchId === AirtouchId) {
                // Match by AC number
                if (my_context.ac_number !== undefined && +my_context.ac_number === ac_number) {
                    // Match AC accessories
                    if (zone_or_ac === magic_1.MAGIC.ZONE_OR_AC.AC && my_context.zone_or_ac === magic_1.MAGIC.ZONE_OR_AC.AC) {
                        return this.accessories[i];
                    }
                    // Match Zone accessories (requires zone number too)
                    if (zone_or_ac === magic_1.MAGIC.ZONE_OR_AC.ZONE && my_context.zone_or_ac === magic_1.MAGIC.ZONE_OR_AC.ZONE) {
                        if (my_context.zone_number !== undefined && +my_context.zone_number === zone_number) {
                            return this.accessories[i];
                        }
                    }
                }
            }
        }
        // No matching accessory found
        return undefined;
    }
}
exports.AirtouchPlatform = AirtouchPlatform;
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
//# sourceMappingURL=platform.js.map