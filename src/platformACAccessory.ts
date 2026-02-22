import { Service, PlatformAccessory, Logger, CharacteristicValue } from 'homebridge';

import { AirtouchPlatform } from './platform';

import { AC, Zone } from './airTouchWrapper';
import { AirtouchAPI } from './api';
import { MAGIC } from './magic';

const WEATHER_POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export class AirTouchACAccessory {
  private service: Service;
  AirtouchId;
  ACNumber;
  minTemp: number;
  maxTemp: number;
  step: number;
  log: Logger;
  ac: AC;
  zones: Array<Zone>;
  api: AirtouchAPI;

  private currentTemperature: number | null = null;
  private weatherPollTimer: NodeJS.Timeout | null = null;
  private latitude: number | null = null;
  private longitude: number | null = null;

  constructor(
    private readonly platform: AirtouchPlatform,
    private readonly accessory: PlatformAccessory,
    AirtouchId,
    ACNumber,
    ac: AC,
    zones: Array<Zone>,
    log: Logger,
    api: AirtouchAPI,
  ) {
    this.AirtouchId = AirtouchId;
    this.ACNumber = ACNumber;
    this.minTemp = 0;
    this.maxTemp = 35;
    this.step = 1;
    this.log = log;
    this.ac = ac;
    this.zones = zones;
    this.api = api;

    // Read lat/long from platform config if provided
    const config = this.platform.config as Record<string, unknown>;
    if (typeof config.latitude === 'number' && typeof config.longitude === 'number') {
      this.latitude = config.latitude as number;
      this.longitude = config.longitude as number;
      this.log.info(`ACACC   | Weather temperature enabled. Location: ${this.latitude}, ${this.longitude}`);
      // Fetch immediately, then start polling
      this.fetchWeatherTemperature();
      this.weatherPollTimer = setInterval(() => this.fetchWeatherTemperature(), WEATHER_POLL_INTERVAL_MS);
    } else {
      this.log.warn('ACACC   | No latitude/longitude in config — falling back to AC unit temperature.');
    }

    this.accessory.getService(this.platform.Service.AccessoryInformation)
      ?.setCharacteristic(this.platform.Characteristic.Manufacturer, 'AirTouch')
      .setCharacteristic(this.platform.Characteristic.Model, 'AirTouch 5')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, this.AirtouchId || 'Unknown');

    this.service = this.accessory.getService(this.platform.Service.HeaterCooler) ||
                    this.accessory.addService(this.platform.Service.HeaterCooler);

    this.service.getCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState)
      .onGet(this.handleCurrentHeaterCoolerStateGet.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState)
      .onGet(this.handleTargetHeaterCoolerStateGet.bind(this))
      .onSet(this.handleTargetHeaterCoolerStateSet.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .onGet(this.handleCurrentTemperatureGet.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.Active)
      .onGet(this.handleActiveGet.bind(this))
      .onSet(this.handleActiveSet.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.Name)
      .onGet(this.handleNameGet.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature)
      .onGet(this.handleTargetTemperatureGet.bind(this))
      .onSet(this.handleTargetTemperatureSet.bind(this)).setProps({
        minValue: this.minTemp,
        maxValue: this.maxTemp,
        minStep: this.step,
      });

    this.service.getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature)
      .onGet(this.handleTargetTemperatureGet.bind(this))
      .onSet(this.handleTargetTemperatureSet.bind(this)).setProps({
        minValue: this.minTemp,
        maxValue: this.maxTemp,
        minStep: this.step,
      });

    this.service.getCharacteristic(this.platform.Characteristic.RotationSpeed)
      .onGet(this.handleRotationSpeedGet.bind(this))
      .onSet(this.handleRotationSpeedSet.bind(this)).setProps({
        minValue: 0,
        maxValue: 99,
        minStep: 33,
      });
  }

  /**
   * Fetch the current outdoor temperature from Open-Meteo (free, no API key required).
   * Updates this.currentTemperature and pushes the update to HomeKit.
   */
  private async fetchWeatherTemperature(): Promise<void> {
    if (this.latitude === null || this.longitude === null) {
      return;
    }
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${this.latitude}&longitude=${this.longitude}` +
      `&current_weather=true&temperature_unit=celsius`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        this.log.warn(`ACACC   | Weather fetch failed: HTTP ${response.status}`);
        return;
      }
      const data = await response.json() as { current_weather?: { temperature?: number } };
      const temp = data?.current_weather?.temperature;
      if (typeof temp === 'number') {
        this.currentTemperature = temp;
        this.log.debug(`ACACC   | Weather temperature updated: ${temp}°C`);
        // Push the new value to HomeKit immediately
        this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
          .updateValue(temp);
      } else {
        this.log.warn('ACACC   | Weather API returned unexpected data shape.');
      }
    } catch (err) {
      this.log.warn(`ACACC   | Weather fetch error: ${err}`);
    }
  }

  updateStatus(ac: AC, zones: Array<Zone>) {
    this.zones = zones;
    this.ac = ac;
  }

  handleRotationSpeedGet() {
    const ac_status = this.ac.ac_status!;
    if (+ac_status.ac_fan_speed > 0) {
      return (+ac_status.ac_fan_speed - 1) * 33;
    }
    return 0;
  }

  handleRotationSpeedSet(value: CharacteristicValue) {
    const numValue = Number(value);
    this.api.acSetFanSpeed(this.ac.ac_number, (numValue / 33) + 1);
  }

  handleActiveGet() {
    const ac_status = this.ac.ac_status!;
    switch (+ac_status.ac_power_state) {
      case 0:
        return this.platform.Characteristic.Active.INACTIVE;
      case 1:
        return this.platform.Characteristic.Active.ACTIVE;
      case 2:
        return this.platform.Characteristic.Active.INACTIVE;
      case 3:
        return this.platform.Characteristic.Active.ACTIVE;
      default:
        return this.platform.Characteristic.Active.INACTIVE;
    }
  }

  handleActiveSet(value: CharacteristicValue) {
    this.log.debug('ACACC   | AC Accessory: Setting active to ' + value);
    const numValue = Number(value);
    switch (numValue) {
      case this.platform.Characteristic.Active.INACTIVE:
        this.api.acSetActive(+this.ac.ac_number, false);
        break;
      case this.platform.Characteristic.Active.ACTIVE:
        this.api.acSetActive(+this.ac.ac_number, true);
        break;
    }
  }

  isNull(val, nullVal) {
    return val === undefined ? nullVal : val;
  }

  updateAll() {
    this.service.getCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState)
      .updateValue(this.handleTargetHeaterCoolerStateGet());
    this.service.getCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState)
      .updateValue(this.handleCurrentHeaterCoolerStateGet());
    this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .updateValue(this.handleCurrentTemperatureGet());
    this.service.getCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature)
      .updateValue(this.handleTargetTemperatureGet());
    this.service.getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature)
      .updateValue(this.handleTargetTemperatureGet());
    this.service.getCharacteristic(this.platform.Characteristic.Name)
      .updateValue(this.handleNameGet());
    this.service.getCharacteristic(this.platform.Characteristic.Active)
      .updateValue(this.handleActiveGet());
    this.service.getCharacteristic(this.platform.Characteristic.RotationSpeed)
      .updateValue(this.handleRotationSpeedGet());
  }

  handleNameGet() {
    return this.ac.ac_ability.ac_name;
  }

  areAllZonesClosed(ac_number: number) {
    for (let i = 0; i < 16; i++) {
      if (this.zones[i] !== undefined) {
        if (this.zones[i].zone_status !== undefined) {
          if (+this.zones[i].ac_number === ac_number && +this.zones[i].zone_status!.zone_damper_position !== 0) {
            return false;
          }
        }
      }
    }
    return true;
  }

  handleCurrentHeaterCoolerStateGet() {
    const ac_status = this.ac.ac_status!;
    const ac_mode = +ac_status.ac_mode;
    const zones_all_off = this.areAllZonesClosed(this.ac.ac_number);
    if (+ac_status.ac_power_state === 0) {
      return this.platform.Characteristic.CurrentHeaterCoolerState.INACTIVE;
    }
    if (zones_all_off === true) {
      return this.platform.Characteristic.CurrentHeaterCoolerState.IDLE;
    }

    const ac_target = ac_status.ac_target;
    const ac_current = ac_status.ac_temp;
    switch (ac_mode) {
      case 0:
        if (ac_target < ac_current) {
          return this.platform.Characteristic.CurrentHeaterCoolerState.COOLING;
        } else {
          return this.platform.Characteristic.CurrentHeaterCoolerState.HEATING;
        }
      case 1:
        return this.platform.Characteristic.CurrentHeaterCoolerState.HEATING;
      case 2:
        this.log.info('ACACC   | AC is set to DRY mode.  This is currently unhandled.  Reporting it as cool instead. ');
        return this.platform.Characteristic.CurrentHeaterCoolerState.COOLING;
      case 3:
        this.log.info('ACACC   | AC is set to FAN mode.  This is currently unhandled.  Reporting it as cool instead. ');
        return this.platform.Characteristic.CurrentHeaterCoolerState.COOLING;
      case 4:
        return this.platform.Characteristic.CurrentHeaterCoolerState.COOLING;
      case 8:
        return this.platform.Characteristic.CurrentHeaterCoolerState.HEATING;
      case 9:
        return this.platform.Characteristic.CurrentHeaterCoolerState.COOLING;
      default:
        this.log.info('ACACC   | Unhandled ac_mode in getCurrentHeatingCoolingState. Returning off as fail safe.');
        return this.platform.Characteristic.CurrentHeaterCoolerState.IDLE;
    }
  }

  handleTargetHeaterCoolerStateGet() {
    const ac_mode = +this.ac.ac_status!.ac_mode;
    switch (ac_mode) {
      case 0:
        return this.platform.Characteristic.TargetHeaterCoolerState.AUTO;
      case 1:
        return this.platform.Characteristic.TargetHeaterCoolerState.HEAT;
      case 2:
        this.log.info('ACACC   | AC is set to DRY mode.  This is currently unhandled.  Reporting it as cool instead. ');
        return this.platform.Characteristic.TargetHeaterCoolerState.COOL;
      case 3:
        this.log.info('ACACC   | AC is set to FAN mode.  This is currently unhandled.  Reporting it as cool instead. ');
        return this.platform.Characteristic.TargetHeaterCoolerState.COOL;
      case 4:
        return this.platform.Characteristic.TargetHeaterCoolerState.COOL;
      case 8:
        return this.platform.Characteristic.TargetHeaterCoolerState.HEAT;
      case 9:
        return this.platform.Characteristic.TargetHeaterCoolerState.COOL;
      default:
        this.log.info('ACACC   | Unhandled ac_mode in getTargetACHeatingCooling. Returning auto as fail safe.');
        return this.platform.Characteristic.TargetHeaterCoolerState.AUTO;
    }
  }

  handleTargetHeaterCoolerStateSet(value: CharacteristicValue) {
    const ac_number = this.ac.ac_number;
    const numValue = Number(value);
    switch (numValue) {
      case this.platform.Characteristic.TargetHeaterCoolerState.COOL:
        this.api.acSetTargetHeatingCoolingState(ac_number, MAGIC.AC_TARGET_STATES.COOL);
        break;
      case this.platform.Characteristic.TargetHeatingCoolingState.HEAT:
        this.api.acSetTargetHeatingCoolingState(ac_number, MAGIC.AC_TARGET_STATES.HEAT);
        break;
      case this.platform.Characteristic.TargetHeatingCoolingState.AUTO:
        this.api.acSetTargetHeatingCoolingState(ac_number, MAGIC.AC_TARGET_STATES.AUTO);
        break;
    }
  }

  /**
   * Returns the current temperature.
   * Uses the weather API value if available, otherwise falls back to the AC unit sensor.
   */
  handleCurrentTemperatureGet() {
    if (this.currentTemperature !== null) {
      return this.currentTemperature;
    }
    // Fallback: use AC unit sensor
    return this.ac.ac_status!.ac_temp;
  }

  handleTargetTemperatureGet() {
    return this.ac.ac_status!.ac_target;
  }

  handleTargetTemperatureSet(value: CharacteristicValue) {
    const numValue = Number(value);
    this.api.acSetTargetTemperature(this.ac.ac_number, numValue);
  }

  /**
   * Call this when the accessory is being destroyed to clean up the poll timer.
   */
  destroy() {
    if (this.weatherPollTimer) {
      clearInterval(this.weatherPollTimer);
      this.weatherPollTimer = null;
    }
  }
}
