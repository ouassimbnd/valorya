// Server-only configuration. Never import this module from a client component.
export function walletConfigured(){
 return ["APPLE_PASS_TYPE_IDENTIFIER","APPLE_TEAM_IDENTIFIER","APPLE_SIGNER_CERT_BASE64","APPLE_SIGNER_KEY_BASE64","APPLE_WWDR_CERT_BASE64","APP_URL"].every(key=>Boolean(process.env[key]));
}
