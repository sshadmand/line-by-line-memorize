export const SCRIPT_COLUMNS = 'id,title,body,redaction,redaction_style,scroll_speed,redaction_lines,version,updated_at';

export function createScriptStore(client, userId) {
  return {
    async list(offset = 0) {
      const { data, error } = await client.from('scripts')
        .select('id,title,version,updated_at').eq('user_id', userId)
        .order('updated_at', { ascending: false }).order('id').range(offset, offset + 49);
      if (error) throw error;
      return data;
    },
    async open(id) {
      const { data, error } = await client.from('scripts').select(SCRIPT_COLUMNS)
        .eq('user_id', userId).eq('id', id).single();
      if (error) throw error;
      return data;
    },
    async save(snapshot, active) {
      const fields = {
        title: snapshot.title.trim() || 'Untitled script', body: snapshot.body,
        redaction: snapshot.redaction, redaction_style: snapshot.redaction_style || 'full', scroll_speed: snapshot.scroll_speed, redaction_lines: snapshot.redaction_lines || 'all',
      };
      let query;
      if (active) {
        query = client.from('scripts').update(fields).eq('user_id', userId)
          .eq('id', active.id).eq('version', active.version);
      } else {
        query = client.from('scripts').insert({ ...fields, user_id: userId });
      }
      const { data, error } = await query.select(SCRIPT_COLUMNS).maybeSingle();
      if (error) throw error;
      if (!data) {
        const conflict = new Error('This script changed on another device or was deleted. Save a copy to keep your changes.');
        conflict.code = 'SCRIPT_CONFLICT';
        throw conflict;
      }
      return data;
    },
    async remove(id, version) {
      const { data, error } = await client.from('scripts').delete()
        .eq('user_id', userId).eq('id', id).eq('version', version).select('id');
      if (error) throw error;
      if (!data?.length) throw new Error('This script changed on another device. Refresh your library before deleting it.');
    },
  };
}
