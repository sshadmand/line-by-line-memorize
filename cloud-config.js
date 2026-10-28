// Only public browser credentials belong here. Never add a service-role key.
export const cloudConfig = {
  // Keep account features off on public hosts until real login is verified.
  enabledInProduction: false,
  url: 'https://eoulcmagatntdubqbbpi.supabase.co',
  publishableKey: 'sb_publishable_X4ty7pTx1VnjIQ2ZIpQkyg_cKWct2UX',
  providers: { google: true, email: false },
};
