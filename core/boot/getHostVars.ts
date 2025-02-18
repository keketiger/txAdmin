import path from 'node:path';
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import fatalError from '@lib/fatalError';
import consts from '@shared/consts';


/**
 * Schemas for the TXHOST_ env variables
 */
export const hostEnvVarSchemas = {
    //General
    DATA_PATH: z.string().min(1).refine(
        (val) => path.isAbsolute(val),
        'DATA_PATH must be an absolute path'
    ),
    QUIET_MODE: z.preprocess((val) => val === 'true', z.boolean()),
    MAX_SLOTS: z.coerce.number().int().positive(),

    //Networking
    TXA_URL: z.string().url(),
    TXA_PORT: z.coerce.number().int().positive().refine(
        (val) => val !== 30120,
        'TXA_PORT cannot be 30120'
    ),
    FXS_PORT: z.coerce.number().int().positive().refine(
        (val) => val < 40120 || val > 40150,
        'FXS_PORT cannot be between 40120 and 40150'
    ),
    INTERFACE: z.string().ip({ version: "v4" }),

    //Provider
    PROVIDER_NAME: z.string().regex(/^[a-zA-Z0-9_.\-]{2,16}$/),
    PROVIDER_LOGO: z.string().url(),

    //Defaults (no reason to coerce or check, except the cfxkey)
    DB_HOST: z.string(),
    DB_PORT: z.string(),
    DB_USER: z.string(),
    DB_PASS: z.string(),
    DB_NAME: z.string(),
    DEFAULT_ACCOUNT: z.string().refine(
        (val) => {
            const parts = val.split(':').length;
            return parts === 2 || parts === 3;
        },
        'The account needs to be in the username:fivemId or username:fivemId:bcrypt format',
    ),
    DEFAULT_CFXKEY: z.string().refine(
        //apparently zap still uses the old format?
        (val) => consts.regexSvLicenseNew.test(val) || consts.regexSvLicenseOld.test(val),
        'The key needs to be in the cfxk_xxxxxxxxxxxxxxxxxxxx_yyyyy format'
    ),
} as const;

export type HostEnvVars = {
    [K in keyof typeof hostEnvVarSchemas]: z.infer<typeof hostEnvVarSchemas[K]> | undefined;
}


/**
 * Parses the TXHOST_ env variables
 */
export const getHostVars = () => {
    const txHostEnv: any = {};
    for (const partialKey of Object.keys(hostEnvVarSchemas)) {
        const keySchema = hostEnvVarSchemas[partialKey as keyof HostEnvVars];
        const fullKey = `TXHOST_` + partialKey;
        const value = process.env[fullKey];
        if (value === undefined || value === '') continue;
        const res = keySchema.safeParse(value);
        if (!res.success) {
            fatalError.GlobalData(20, [
                'Invalid value for TXHOST environment variable.',
                ['Key', fullKey],
                ['Value', String(value)],
                'For more information: https://aka.cfx.re/txadmin-host-config',
            ], fromZodError(res.error, {prefix: null}));
        }
        txHostEnv[partialKey] = res.data;
    }
    return txHostEnv as HostEnvVars;
}
