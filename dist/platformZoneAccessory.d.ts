import { PlatformAccessory, Logger, CharacteristicValue } from 'homebridge';
import { AirtouchPlatform } from './platform';
import { AC, Zone } from './airTouchWrapper';
import { AirtouchAPI } from './api';
export declare class AirTouchZoneAccessory {
    private readonly platform;
    private readonly accessory;
    private service;
    private batteryService;
    AirtouchId: any;
    ZoneNumber: any;
    private ac;
    private zone;
    log: Logger;
    api: AirtouchAPI;
    constructor(platform: AirtouchPlatform, accessory: PlatformAccessory, AirtouchId: string, ZoneNumber: number, zone: Zone, ac: AC, log: Logger, api: AirtouchAPI);
    updateStatus(zone: Zone, ac: AC): void;
    updateAll(): void;
    handleNameGet(): string;
    handleBatteryLowGet(): 0 | 1;
    handleActiveGet(): 0 | 1;
    handleActiveSet(value: CharacteristicValue): void;
    handleRotationSpeedGet(): number;
    handleRotationSpeedSet(value: CharacteristicValue): void;
}
//# sourceMappingURL=platformZoneAccessory.d.ts.map