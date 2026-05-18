# beebbeeb_shopping

## إشعارات واتساب للطلبات (CallMeBot)

1. سجّل رقمك مع [CallMeBot](https://www.callmebot.com/blog/free-api-whatsapp-messages/) واحصل على **API key**.
2. في Supabase → **SQL Editor**، نفّذ الملف `supabase_order_whatsapp_notify.sql` مرة واحدة.
3. في لوحة الإدارة → **Content** → قسم **Order WhatsApp alerts**:
   - فعّل الإشعارات
   - أدخل رقمك بصيغة دولية بدون `+` (مثل `9647xxxxxxxx`)
   - الصق مفتاح CallMeBot
   - **Save** ثم **Send test message**
4. عند كل طلب جديد (بعد تثبيت المخزون)، تصل رسالة واتساب تلقائياً من السيرفر — المفتاح لا يظهر في المتصفح للزوار.
