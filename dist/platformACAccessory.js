"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AirTouchACAccessory = void 0;
const http = __importStar(require("http"));
const magic_1 = require("./magic");
const TEMP_SERVER_PORT = 8583;
class AirTouchACAccessory {
    constructor(platform, accessory, AirtouchId, ACNumber, ac, zones, log, api) {
        this.platform = platform;
        this.accessory = accessory;
        this.currentTemperature = null;
        this.tempServer = null;
        this.AirtouchId = AirtouchId;
        this.ACNumber = ACNumber;
        this.minTemp = 0;
        this.maxTemp = 35;
        this.step = 1;
        this.log = log;
        this.ac = ac;
        this.zones = zones;
        this.api = api;
        // Start HTTP server to receive temperature pushed from Shortcuts
        this.startTemperatureServer();
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
     * Starts a tiny HTTP server that listens for temperature pushes from Shortcuts.
     * Your Shortcut should hit: GET http://192.168.0.106:8583/temperature/23.5
     */
    startTemperatureServer() {
        this.tempServer = http.createServer((req, res) => {
            const match = req.url?.match(/^\/temperature\/([\d.]+)$/);
            if (match) {
                const temp = parseFloat(match[1]);
                if (!isNaN(temp)) {
                    this.currentTemperature = temp;
                    this.log.debug(`ACACC   | Temperature updated from Shortcuts: ${temp}°C`);
                    this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
                        .updateValue(temp);
                    res.writeHead(200);
                    res.end('OK');
                }
                else {
                    res.writeHead(400);
                    res.end('Bad temperature value');
                }
            }
            else {
                res.writeHead(404);
                res.end('Not found - use /temperature/23.5');
            }
        });
        this.tempServer.listen(TEMP_SERVER_PORT, () => {
            this.log.info(`ACACC   | Temperature server listening on port ${TEMP_SERVER_PORT}`);
            this.log.info(`ACACC   | Push temp via: http://192.168.0.106:${TEMP_SERVER_PORT}/temperature/23.5`);
        });
        this.tempServer.on('error', (err) => {
            this.log.warn(`ACACC   | Temperature server error: ${err.message}`);
        });
    }
    updateStatus(ac, zones) {
        this.zones = zones;
        this.ac = ac;
    }
    handleRotationSpeedGet() {
        const ac_status = this.ac.ac_status;
        if (+ac_status.ac_fan_speed > 0) {
            return (+ac_status.ac_fan_speed - 1) * 33;
        }
        return 0;
    }
    handleRotationSpeedSet(value) {
        const numValue = Number(value);
        this.api.acSetFanSpeed(this.ac.ac_number, (numValue / 33) + 1);
    }
    handleActiveGet() {
        const ac_status = this.ac.ac_status;
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
    handleActiveSet(value) {
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
    areAllZonesClosed(ac_number) {
        for (let i = 0; i < 16; i++) {
            if (this.zones[i] !== undefined) {
                if (this.zones[i].zone_status !== undefined) {
                    if (+this.zones[i].ac_number === ac_number && +this.zones[i].zone_status.zone_damper_position !== 0) {
                        return false;
                    }
                }
            }
        }
        return true;
    }
    handleCurrentHeaterCoolerStateGet() {
        const ac_status = this.ac.ac_status;
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
                }
                else {
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
        const ac_mode = +this.ac.ac_status.ac_mode;
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
    handleTargetHeaterCoolerStateSet(value) {
        const ac_number = this.ac.ac_number;
        const numValue = Number(value);
        switch (numValue) {
            case this.platform.Characteristic.TargetHeaterCoolerState.COOL:
                this.api.acSetTargetHeatingCoolingState(ac_number, magic_1.MAGIC.AC_TARGET_STATES.COOL);
                break;
            case this.platform.Characteristic.TargetHeatingCoolingState.HEAT:
                this.api.acSetTargetHeatingCoolingState(ac_number, magic_1.MAGIC.AC_TARGET_STATES.HEAT);
                break;
            case this.platform.Characteristic.TargetHeatingCoolingState.AUTO:
                this.api.acSetTargetHeatingCoolingState(ac_number, magic_1.MAGIC.AC_TARGET_STATES.AUTO);
                break;
        }
    }
    handleCurrentTemperatureGet() {
        if (this.currentTemperature !== null) {
            return this.currentTemperature;
        }
        // Fallback: use AC unit sensor
        return this.ac.ac_status.ac_temp;
    }
    handleTargetTemperatureGet() {
        return this.ac.ac_status.ac_target;
    }
    handleTargetTemperatureSet(value) {
        const numValue = Number(value);
        this.api.acSetTargetTemperature(this.ac.ac_number, numValue);
    }
    destroy() {
        if (this.tempServer) {
            this.tempServer.close();
            this.tempServer = null;
        }
    }
}
exports.AirTouchACAccessory = AirTouchACAccessory;
//# sourceMappingURL=platformACAccessory.js.map