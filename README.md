# beebbeeb_shopping

## إشعارات الطلبات (CallMeBot)

يدعم **واتساب** و/أو **Signal** عند كل طلب جديد.

### 1) Supabase

نفّذ مرة واحدة في **SQL Editor**: `supabase_order_whatsapp_notify.sql`

### 2) تفعيل CallMeBot

| القناة | التسجيل |
|--------|---------|
| WhatsApp | [callmebot.com/whatsapp](https://www.callmebot.com/blog/free-api-whatsapp-messages/) |
| Signal | [callmebot.com/signal](https://www.callmebot.com/blog/free-api-signal-messages/) |

لكل قناة مفتاح API خاص بها.

### 3) لوحة الإدارة

**Admin → Content → Order alerts**

- **WhatsApp:** رقم بدون `+` (مثل `9647xxxxxxxx`)
- **Signal:** رقم مع رمز الدولة (مثل `+9647...`) أو **UUID** من Signal
- فعّل القناة، الصق المفتاح، **Save**، ثم **Test WhatsApp** أو **Test Signal**

يمكن تفعيل القناتين معاً؛ عند الطلب تُرسل رسالة لكل قناة مفعّلة.
