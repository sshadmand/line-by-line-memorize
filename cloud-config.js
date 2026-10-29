// Only public browser credentials belong here. Never add a service-role key.
export const cloudConfig = {
  // Set false to hide account features and disable cloud startup on public hosts.
  enabledInProduction: true,
  url: 'https://eoulcmagatntdubqbbpi.supabase.co',
  publishableKey: 'sb_publishable_X4ty7pTx1VnjIQ2ZIpQkyg_cKWct2UX',
  providers: { google: true, email: false },
};
