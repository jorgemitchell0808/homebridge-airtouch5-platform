import { PlatformAccessory, Logger, CharacteristicValue } from 'homebridge';
import { AirtouchPlatform } from './platform';
import { AC, Zone } from './airTouchWrapper';
import { AirtouchAPI } from './api';
export declare class AirTouchACAccessory {
    private readonly platform;
    private readonly accessory;
    private service;
    AirtouchId: any;
    ACNumber: any;
    minTemp: number;
    maxTemp: number;
    step: number;
    log: Logger;
    ac: AC;
    zones: Array<Zone>;
    api: AirtouchAPI;
    private currentTemperature;
    private tempServer;
    constructor(platform: AirtouchPlatform, accessory: PlatformAccessory, AirtouchId: any, ACNumber: any, ac: AC, zones: Array<Zone>, log: Logger, api: AirtouchAPI);
    /**
     * Starts a tiny HTTP server that listens for temperature pushes from Shortcuts.
     * Your Shortcut should hit: GET http://192.168.0.106:8583/temperature/23.5
     */
    private startTemperatureServer;
    updateStatus(ac: AC, zones: Array<Zone>): void;
    handleRotationSpeedGet(): number;
    handleRotationSpeedSet(value: CharacteristicValue): void;
    handleActiveGet(): 0 | 1;
    handleActiveSet(value: CharacteristicValue): void;
    isNull(val: any, nullVal: any): any;
    updateAll(): void;
    handleNameGet(): string;
    areAllZonesClosed(ac_number: number): boolean;
    handleCurrentHeaterCoolerStateGet(): 0 | 1 | 2 | 3;
    handleTargetHeaterCoolerStateGet(): 0 | 1 | 2;
    handleTargetHeaterCoolerStateSet(value: CharacteristicValue): void;
    handleCurrentTemperatureGet(): number;
    handleTargetTemperatureGet(): number;
    handleTargetTemperatureSet(value: CharacteristicValue): void;
    destroy(): void;
}
//# sourceMappingURL=platformACAccessory.d.ts.map