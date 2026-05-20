# beebbeeb_shopping

## إشعارات الطلبات على واتساب (GREEN-API)

1. أنشئ Instance في [console.green-api.com](https://console.green-api.com) واربطه بواتساب (**Authorized**).
2. في Supabase → **SQL Editor** نفّذ `supabase_order_whatsapp_notify.sql` (أعد التشغيل بعد كل تحديث للملف).
3. **Admin → Content → Order alerts (GREEN-API)**:
   - **apiUrl** — من لوحة GREEN-API (مثل `https://7107.api.greenapi.com`)
   - **idInstance** — رقم الـ Instance
   - **apiTokenInstance** — التوكن من اللوحة
   - **Notify phone** — رقم المستلم (أرقام فقط، مثل `9647777010004` — عادة نفس رقم الـ Instance لإرسال التنبيه لنفسك)
4. فعّل الخيار → **Save** → **Test WhatsApp (GREEN-API)**

عند كل طلب جديد تُرسل رسالة عبر `sendMessage` من السيرفر (pg_net).

**أمان:** لا تضع `apiTokenInstance` في الكود أو Git — فقط من لوحة الإدارة.
