# Supabase Advisors (sarı / yeşil uyarılar)

## Sarı (WARN)

### `extension_in_public` (PostGIS)

PostGIS’in `public` şemada olması yaygın; **taşımak** büyük migration + risk.  
**Öneri:** Uyarıyı kabul edin veya ileride Supabase’in resmi PostGIS şema rehberine göre planlayın. Şimdilik **yapılacak zorunlu geliştirme yok**.

### `auth_leaked_password_protection` (Have I Been Pwned)

Pro planında veya ayarlarda açılıyor olabilir. **Açamıyorsanız:**  
Şifre gücü için uygulama tarafında zorunlu uzunluk/karmaşıklık zaten iyi pratik. Bu uyarıyı **bilerek kabul** edebilirsiniz.

---

## Yeşil / INFO (`rls_enabled_no_policy`)

RLS açık ama policy yoktu; linter “unutulmuş policy” sayıyordu.

**Yapılan:** `20260322100000_rls_policies_internal_tables.sql`

- **admin_audit_log:** Sadece `user_profiles.is_admin = true` kullanıcılar SELECT (Admin ekranı).
- **Diğer 19 tablo:** `anon` + `authenticated` için `USING (false)` — doğrudan client erişimi yok.  
  **Edge Functions (service_role)** RLS’i bypass eder; mevcut akış bozulmaz.

Uygulama: `supabase db push`

---

## Özet

| Uyarı | Aksiyon |
|--------|---------|
| PostGIS public | Genelde yok say / ileride planla |
| Leaked password | Pro yoksa kabul; client’ta güçlü şifre kuralı |
| RLS no policy | Migration ile giderildi (push) |
