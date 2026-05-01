export const GOOGLE_CLIENT_IDS = 
{
    web: '88843093287-r3movj7uokcg17ljhrn0t351vvedud9a.apps.googleusercontent.com',
    ios: undefined as string | undefined,
    android: undefined as string | undefined,
}

export const isGoogleAuthSupported = typeof window !== 'undefined' ? true : GOOGLE_CLIENT_IDS.ios !== undefined || GOOGLE_CLIENT_IDS.android !== undefined