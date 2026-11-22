export interface LocalUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  user_metadata: { name: string; full_name?: string; avatar_url?: string; picture?: string };
  created_at: string;
  last_sign_in_at: string | null;
  needs_password: boolean;
  is_active: boolean;
  deleted_at: string | null;
  registration_id?:number|null;
}
export async function api<T = any>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${url}`, {
    ...options, credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}
