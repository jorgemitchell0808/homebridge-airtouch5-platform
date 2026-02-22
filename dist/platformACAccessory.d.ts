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
    private weatherPollTimer;
    private latitude;
    private longitude;
    constructor(platform: AirtouchPlatform, accessory: PlatformAccessory, AirtouchId: any, ACNumber: any, ac: AC, zones: Array<Zone>, log: Logger, api: AirtouchAPI);
    /**
     * Fetch the current outdoor temperature from Open-Meteo (free, no API key required).
     * Updates this.currentTemperature and pushes the update to HomeKit.
     */
    private fetchWeatherTemperature;
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
    /**
     * Returns the current temperature.
     * Uses the weather API value if available, otherwise falls back to the AC unit sensor.
     */
    handleCurrentTemperatureGet(): number;
    handleTargetTemperatureGet(): number;
    handleTargetTemperatureSet(value: CharacteristicValue): void;
    /**
     * Call this when the accessory is being destroyed to clean up the poll timer.
     */
    destroy(): void;
}
//# sourceMappingURL=platformACAccessory.d.ts.map