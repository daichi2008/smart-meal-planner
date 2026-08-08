# دليل تكامل Volet مع Smart Meal Planner

## 🔑 الخطوات المطلوبة

### 1. إنشاء حساب Volet للتاجر
1. اذهب إلى [volet.app](https://volet.app)
2. سجّل كحساب تاجر (Merchant Account)
3. أكمل عملية التحقق والتفعيل

### 2. إعدادات SCI في Volet
1. اذهب إلى **Settings** → **Integration** → **SCI/API Keys**
2. أنشئ مفتاح API جديد
3. احفظ هذه البيانات:
   - **Merchant ID** ← `VOLET_MERCHANT_ID`
   - **API Key** ← `VOLET_API_KEY`
   - **Secret Key** ← `VOLET_SECRET_KEY`

### 3. تحديث ملف .env
```bash
# Backend configuration
VOLET_MERCHANT_ID=your-merchant-id-here
VOLET_API_KEY=your-api-key-here
VOLET_SECRET_KEY=your-secret-key-here

# Pricing configuration
VOLET_WEEKLY_PRICE_USD=2.00
VOLET_MONTHLY_PRICE_USD=7.00

# Subscription duration
VOLET_WEEKLY_SUBSCRIPTION_DAYS=7
VOLET_MONTHLY_SUBSCRIPTION_DAYS=30
```

### 4. تكوين Webhook
1. في لوحة تحكم Volet → Settings → Webhooks
2. أضف Webhook جديد:
   - **URL**: `https://your-domain.com/api/v1/subscription/volet/webhook`
   - **Events**: `payment.completed`, `payment.failed`, `payment.refunded`
   - **Secret**: استخدم `VOLET_SECRET_KEY` الخاص بك

### 5. اختبر التكامل
```bash
# في بيئة التطوير
cd backend
python -m uvicorn app.main:app --reload

# استخدم test-pricing.sh للاختبار
bash test-pricing.sh
```

---

## 💳 خطوات الدفع

### التدفق العام:
1. المستخدم يختار خطة (Weekly/Pro)
2. المستخدم يختار طريقة دفع (Volet/AdvCash)
3. النقر على "Subscribe" أو "Upgrade"
4. يتم إنشاء Order ID جديد
5. إعادة التوجيه إلى صفحة الدفع في Volet
6. المستخدم يكمل الدفع
7. Volet يرسل Webhook للتأكيد
8. تفعيل الاشتراك تلقائياً

---

## 🔐 الأمان

### التحقق من التوقيع (Signature Verification)
كل طلب من Volet يتضمن توقيع SHA256:

```python
signature = SHA256(merchant_id:order_id:amount:plan_id:secret_key)
```

**النظام يتحقق من:**
- ✅ صحة التوقيع
- ✅ المبلغ المدفوع
- ✅ ID الطلب
- ✅ عدم تكرار الدفعة

### الممارسات الآمنة:
- استخدم HTTPS فقط في الإنتاج
- لا تشارك `SECRET_KEY` في الكود
- حفّظ البيانات الحساسة في ملفات البيئة
- سجّل جميع المعاملات للتدقيق

---

## 📊 نموذج قاعدة البيانات

### جدول الاشتراكات
```python
class Subscription:
    id: str                          # معرّف فريد
    user_id: str                     # المستخدم
    provider_order_id: str           # Order ID من Volet
    provider_transfer_id: str        # Transaction ID من Volet
    amount_usd: float               # المبلغ المدفوع
    status: SubscriptionStatus      # الحالة (ACTIVE, CANCELED, إلخ)
    current_period_end: datetime    # تاريخ انتهاء الاشتراك
    cancel_at_period_end: bool      # إلغاء عند نهاية الفترة
    created_at: datetime
    updated_at: datetime
```

---

## 🛠️ API Endpoints

### GET /api/v1/subscription/plans
احصل على قائمة الخطط المتاحة

```json
[
  {
    "id": "free",
    "name": "Free",
    "price_cents": 0,
    "features": [...]
  },
  {
    "id": "weekly",
    "name": "Weekly",
    "price_cents": 200,
    "features": [...]
  },
  {
    "id": "pro",
    "name": "Monthly Pro",
    "price_cents": 700,
    "features": [...]
  }
]
```

### GET /api/v1/subscription/me
احصل على حالة اشتراكك الحالي

```json
{
  "plan": "weekly",
  "is_pro": false,
  "status": "active",
  "current_period_end": "2026-08-15T00:00:00Z",
  "cancel_at_period_end": false
}
```

### POST /api/v1/subscription/checkout
إنشاء جلسة دفع

**Parameters:**
- `plan_id` (string): `weekly` أو `pro`
- `provider` (string): `volet` أو `advcash`

**Response:**
```json
{
  "action_url": "https://volet.app/checkout",
  "fields": {
    "merchant_id": "...",
    "order_id": "smp-...",
    "amount": "2.00",
    "signature": "...",
    ...
  }
}
```

### POST /api/v1/subscription/volet/webhook
استقبال إشعار الدفع من Volet

**Parameters (من Volet):**
```json
{
  "order_id": "smp-...",
  "amount": "2.00",
  "status": "completed",
  "plan_id": "weekly",
  "transaction_id": "volet-...",
  "signature": "..."
}
```

---

## 🐛 استكشاف الأخطاء

### المشكلة: "Volet is not configured"
**السبب:** متغيرات البيئة غير محددة
```bash
# الحل
export VOLET_MERCHANT_ID=...
export VOLET_API_KEY=...
export VOLET_SECRET_KEY=...
```

### المشكلة: "Signature verification failed"
**السبب:** Secret Key غير صحيح أو بيانات مشوّهة
```bash
# تحقق من:
1. أن VOLET_SECRET_KEY مطابقة في Volet
2. أن البيانات لم تُعدّل أثناء النقل
3. أن الترميز بـ UTF-8
```

### المشكلة: "Webhook not received"
**السبب:** مشكلة في الشبكة أو الإعدادات
```bash
# تحقق من:
1. أن BACKEND_URL صحيح وعام
2. أن Firewall لا يحجب الطلبات
3. استخدام HTTPS في الإنتاج
4. تفعيل Webhook في لوحة Volet
```

---

## 📈 المراقبة والتسجيل

### السجلات المهمة:
```python
# في logs/
- subscriptions.log      # معاملات الاشتراكات
- volet_webhooks.log   # إشعارات Volet
- payment_errors.log   # أخطاء الدفع
```

### الإحصائيات:
```bash
# مثال: عدد الاشتراكات النشطة
SELECT COUNT(*) FROM subscriptions WHERE status = 'active'

# مثال: إجمالي الإيرادات
SELECT SUM(amount_usd) FROM subscriptions WHERE status = 'active'
```

---

## 🧪 الاختبار في بيئة التطوير

### استخدام Volet Sandbox
```bash
# في .env للاختبار
ENVIRONMENT=development
VOLET_MERCHANT_ID=test-merchant-id
VOLET_API_KEY=test-api-key
VOLET_SECRET_KEY=test-secret-key
```

### اختبر الدفع الفاشل:
قم بتحويل المبلغ إلى رقم سالب أثناء الاختبار

```bash
# هذا سيفشل تلقائياً
VOLET_MONTHLY_PRICE_USD=-7.00
```

---

## 📚 مراجع إضافية

- [Volet API Documentation](https://volet.app/api/docs)
- [Volet Merchant Guide](https://volet.app/merchant/guide)
- [Smart Meal Planner Docs](./README.md)

---

**آخر تحديث:** 8 أغسطس 2026
**الإصدار:** v2.0
