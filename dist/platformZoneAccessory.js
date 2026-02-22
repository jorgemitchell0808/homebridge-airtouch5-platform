"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AirTouchZoneAccessory = void 0;
class AirTouchZoneAccessory {
    constructor(platform, accessory, AirtouchId, ZoneNumber, zone, ac, log, api) {
        this.platform = platform;
        this.accessory = accessory;
        this.AirtouchId = AirtouchId;
        this.ZoneNumber = ZoneNumber;
        this.ac = ac;
        this.zone = zone;
        this.log = log;
        this.api = api;
        this.accessory.getService(this.platform.Service.AccessoryInformation)
            ?.setCharacteristic(this.platform.Characteristic.Manufacturer, 'AirTouch')
            .setCharacteristic(this.platform.Characteristic.Model, 'AirTouch 5')
            .setCharacteristic(this.platform.Characteristic.SerialNumber, this.AirtouchId || 'Unknown');
        // Use Fanv2 service so we get Active + RotationSpeed without heating/cooling clutter
        this.service = this.accessory.getService(this.platform.Service.Fanv2) ||
            this.accessory.addService(this.platform.Service.Fanv2);
        this.batteryService = this.accessory.getService(this.platform.Service.Battery) ||
            this.accessory.addService(this.platform.Service.Battery);
        this.batteryService.getCharacteristic(this.platform.Characteristic.StatusLowBattery)
            .onGet(this.handleBatteryLowGet.bind(this));
        this.service.setPrimaryService();
        this.service.addLinkedService(this.batteryService);
        // Zone name
        this.service.getCharacteristic(this.platform.Characteristic.Name)
            .onGet(this.handleNameGet.bind(this));
        // Active (zone on/off)
        this.service.getCharacteristic(this.platform.Characteristic.Active)
            .onGet(this.handleActiveGet.bind(this))
            .onSet(this.handleActiveSet.bind(this));
        // Damper position as rotation speed, 25% steps
        this.service.getCharacteristic(this.platform.Characteristic.RotationSpeed)
            .onGet(this.handleRotationSpeedGet.bind(this))
            .onSet(this.handleRotationSpeedSet.bind(this))
            .setProps({
            minValue: 0,
            maxValue: 100,
            minStep: 25,
        });
    }
    updateStatus(zone, ac) {
        this.zone = zone;
        this.ac = ac;
        this.updateAll();
    }
    updateAll() {
        this.service.getCharacteristic(this.platform.Characteristic.Active)
            .updateValue(this.handleActiveGet());
        this.service.getCharacteristic(this.platform.Characteristic.RotationSpeed)
            .updateValue(this.handleRotationSpeedGet());
        this.service.getCharacteristic(this.platform.Characteristic.Name)
            .updateValue(this.handleNameGet());
        this.batteryService.getCharacteristic(this.platform.Characteristic.StatusLowBattery)
            .updateValue(this.handleBatteryLowGet());
    }
    handleNameGet() {
        return this.zone.zone_name;
    }
    handleBatteryLowGet() {
        const zone_status = this.zone.zone_status;
        return +zone_status.zone_battery_low === 0
            ? this.platform.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL
            : this.platform.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW;
    }
    handleActiveGet() {
        const zone_status = this.zone.zone_status;
        return +zone_status.zone_power_state === 1
            ? this.platform.Characteristic.Active.ACTIVE
            : this.platform.Characteristic.Active.INACTIVE;
    }
    handleActiveSet(value) {
        const numValue = Number(value);
        this.log.debug('ZONEACC | Zone setting active to: ' + numValue);
        const current = +this.zone.zone_status.zone_power_state;
        if (current !== numValue) {
            this.api.zoneSetActive(+this.zone.zone_number, numValue === this.platform.Characteristic.Active.ACTIVE);
        }
    }
    handleRotationSpeedGet() {
        const raw = +this.zone.zone_status.zone_damper_position;
        // Round to nearest 25% step
        return Math.round(raw / 25) * 25;
    }
    handleRotationSpeedSet(value) {
        const numValue = Number(value);
        this.log.debug('ZONEACC | Zone setting damper to: ' + numValue + '%');
        this.api.zoneSetPercentage(+this.zone.zone_number, numValue);
    }
}
exports.AirTouchZoneAccessory = AirTouchZoneAccessory;
//# sourceMappingURL=platformZoneAccessory.js.map