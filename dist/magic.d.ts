export declare class MAGIC {
    static HEADER_BYTES: number[];
    static ADDRESS_STANDARD_BYTES: number[];
    static ADDRESS_EXTENDED_BYTES: number[];
    static MSGTYPE_STANDARD: number;
    static MSGTYPE_EXTENDED: number;
    static SUBTYPE_ZONE_CTRL: number;
    static SUBTYPE_ZONE_STAT: number;
    static SUBTYPE_AC_CTRL: number;
    static SUBTYPE_AC_STAT: number;
    static EXT_SUBTYPE_AC_ABILITY: number;
    static EXT_SUBTYPE_AC_ERROR: number;
    static EXT_SUBTYPE_ZONE_NAME: number;
    static LENGTH_AC_ABILITY: number;
    static AC_POWER_STATES: {
        KEEP: number;
        NEXT: number;
        OFF: number;
        ON: number;
    };
    static AC_MODES: {
        AUTO: number;
        HEAT: number;
        DRY: number;
        FAN: number;
        COOL: number;
        KEEP: number;
    };
    static AC_FAN_SPEEDS: {
        AUTO: number;
        QUIET: number;
        LOW: number;
        MEDIUM: number;
        HIGH: number;
        POWERFUL: number;
        TURBO: number;
        INTELLIGENT: number;
        KEEP: number;
    };
    static AC_TARGET_TYPES: {
        KEEP: number;
        SET_VALUE: number;
    };
    static AC_UNIT_DEFAULT: number;
    static AC_TARGET_DEFAULT: number;
    static ZONE_POWER_STATES: {
        KEEP: number;
        NEXT: number;
        OFF: number;
        ON: number;
        TURBO: number;
    };
    static AC_TARGET_STATES: {
        OFF: number;
        HEAT: number;
        COOL: number;
        AUTO: number;
    };
    static ZONE_TARGET_TYPES: {
        KEEP: number;
        DECREMENT: number;
        INCREMENT: number;
        DAMPER: number;
        TEMPERATURE: number;
    };
    static ZONE_NUMBER_DEFAULT: number;
    static ATTR_NAME: string;
    static ATTR_ZONE_POWER: string;
    static ATTR_ZONE_PERCENTAGE: string;
    static ATTR_CURRENT_HEATCOOL: string;
    static ATTR_TARGET_HEATCOOL: string;
    static ATTR_CURRENT_TEMP: string;
    static ATTR_TARGET_TEMP: string;
    static ATTR_AC_ACTIVE: string;
    static ZONE_OR_AC: {
        ZONE: string;
        AC: string;
    };
}
//# sourceMappingURL=magic.d.ts.map