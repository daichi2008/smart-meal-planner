# نقاط شاملة للتعديلات الجديدة

## 📋 الملخص
تمت إضافة الميزات التالية:
1. ✅ خطة أسبوعية جديدة بسعر $2
2. ✅ تحديث خطة Pro الشهرية إلى $7
3. ✅ دعم طريقة دفع Volet بالإضافة إلى AdvCash
4. ✅ واجهة مستخدم محدثة لاختيار طريقة الدفع
5. ✅ ترجمة كاملة للعربية والإنجليزية

---

## 🔧 التعديلات في Backend

### 1. **نموذج المستخدم** - `backend/app/models/user.py`
- أضيفت خطة جديدة `WEEKLY = "weekly"` للخطة الأسبوعية
- الخطط الآن: `FREE`, `WEEKLY`, `PRO`

```python
class Plan(str, Enum):
    FREE = "free"
    WEEKLY = "weekly"
    PRO = "pro"
```

### 2. **خدمة Volet الجديدة** - `backend/app/services/volet_service.py`
- ملف جديد تماماً يدير مدفوعات Volet
- يحتوي على:
  - `build_checkout_fields()`: بناء نموذج الدفع
  - `verify_webhook_payload()`: التحقق من توقيع الويب هوك
  - معالجة آمنة للتوقيعات

### 3. **إعدادات التطبيق** - `backend/app/core/config.py`
إضافة متغيرات بيئية جديدة:

```python
# Volet payment gateway
VOLET_MERCHANT_ID: str = ""
VOLET_API_KEY: str = ""
VOLET_SECRET_KEY: str = ""
VOLET_WEEKLY_PRICE_USD: float = 2.0
VOLET_MONTHLY_PRICE_USD: float = 7.0
VOLET_WEEKLY_SUBSCRIPTION_DAYS: int = 7
VOLET_MONTHLY_SUBSCRIPTION_DAYS: int = 30
```

### 4. **API للاشتراكات** - `backend/app/api/v1/subscription.py`

#### تحديثات:
- دعم جلب قائمة الخطط من API بدلاً من hardcoding:
  - الخطة المجانية: $0
  - الخطة الأسبوعية: $2
  - الخطة الشهرية Pro: $7

- تحديث `POST /subscription/checkout`:
  - إضافة معاملات اختيارية:
    - `plan_id`: المطلوبة (weekly, pro)
    - `provider`: طريقة الدفع (volet, advcash)
  - دعم كلا طريقتي الدفع

```bash
# مثال:
POST /subscription/checkout?plan_id=weekly&provider=volet
POST /subscription/checkout?plan_id=pro&provider=advcash
```

- إضافة webhook جديد `POST /subscription/volet/webhook`:
  - معالجة إشعارات الدفع من Volet
  - تفعيل الاشتراك تلقائياً
  - دعم خطط مختلفة (weekly/monthly)

---

## 🎨 التعديلات في Frontend

### 1. **صفحة التسعير** - `frontend/src/app/pricing/page.tsx`

#### تحسينات:
- ✅ جلب الخطط من API بدلاً من hardcoding
- ✅ عرض 3 خطط (Free, Weekly, Pro)
- ✅ واجهة اختيار طريقة دفع:
  - Volet (مفضل)
  - AdvCash
- ✅ معالجة حالات التحميل والأخطاء
- ✅ تصميم محسّن مع Tailwind CSS

### 2. **ملفات الترجمة**

#### `frontend/src/lib/i18n/en.ts` و `ar.ts`
إضافة مفاتيح جديدة:

**الإنجليزية:**
```javascript
// New keys
weekly: '/ week'
planWeeklyName: 'Weekly'
subscribeWeekly: 'Subscribe to Weekly'
failedToLoadPlans: 'Failed to load pricing plans'
loadingPlans: 'Loading plans...'
paymentSecurityNotice: 'All payments are processed securely...'
```

**العربية:**
```javascript
// New keys
weekly: '/ أسبوعياً'
planWeeklyName: 'أسبوعي'
subscribeWeekly: 'اشترك في الخطة الأسبوعية'
failedToLoadPlans: 'فشل تحميل خطط التسعير'
loadingPlans: 'جاري تحميل الخطط...'
paymentSecurityNotice: 'تتم معالجة جميع الدفعات بشكل آمن...'
```

---

## 📝 ملف الإعدادات (.env)

تحديث `backend/.env.example`:

```env
# Volet Configuration
VOLET_MERCHANT_ID=your-merchant-id
VOLET_API_KEY=your-api-key
VOLET_SECRET_KEY=your-secret-key
VOLET_WEEKLY_PRICE_USD=2.00
VOLET_MONTHLY_PRICE_USD=7.00
VOLET_WEEKLY_SUBSCRIPTION_DAYS=7
VOLET_MONTHLY_SUBSCRIPTION_DAYS=30
```

---

## 🚀 خطوات التثبيت

### 1. تحديث البيئة
```bash
cp backend/.env.example backend/.env
# ثم أضف بيانات Volet إلى .env:
# VOLET_MERCHANT_ID=...
# VOLET_API_KEY=...
# VOLET_SECRET_KEY=...
```

### 2. تشغيل Migration (إن وجد)
```bash
# إذا كان هناك نظام migrations
alembic upgrade head
```

### 3. إعادة تشغيل الخادم
```bash
# Backend
cd backend
python -m uvicorn app.main:app --reload

# Frontend
cd frontend
npm run dev
```

---

## 🧪 اختبار الميزات الجديدة

### 1. اختبار صفحة التسعير:
```
http://localhost:3000/pricing
```
- ✓ يجب أن تشاهد 3 خطط
- ✓ يجب أن تشاهد أزرار لاختيار Volet أو AdvCash
- ✓ الأسعار صحيحة ($0, $2, $7)

### 2. اختبار الدفع:
```bash
# جرب الاشتراك في الخطة الأسبوعية عبر Volet
curl -X POST "http://localhost:8000/api/v1/subscription/checkout?plan_id=weekly&provider=volet" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3. اختبار webhook Volet:
```bash
# محاكاة إشعار من Volet
curl -X POST "http://localhost:8000/api/v1/subscription/volet/webhook" \
  -d "order_id=smp-123&amount=2.00&status=completed&plan_id=weekly&signature=..."
```

---

## 🔐 الأمان

- ✅ التحقق من التوقيع (SHA256) لكل طلب من Volet
- ✅ التحقق من المبلغ المدفوع
- ✅ منع الدفعات المكررة
- ✅ تسجيل جميع المعاملات

---

## 📊 خطط التسعير الجديدة

| الخطة | السعر | المدة | المميزات |
|------|------|------|---------|
| Free | $0 | مجاني | 20 مكون، 5 وصفات يومياً |
| Weekly | $2 | 7 أيام | مكونات غير محدودة، 20 وصفة/يوم |
| Pro | $7 | 30 يوم | كل شيء غير محدود + أولوية |

---

## 🐛 معالجة الأخطاء

### خطأ شائع: "Volet not configured"
**الحل:** تأكد من ملء متغيرات البيئة:
```bash
VOLET_MERCHANT_ID
VOLET_API_KEY
VOLET_SECRET_KEY
```

### خطأ: "Signature verification failed"
**الحل:** تأكد أن `VOLET_SECRET_KEY` صحيح في الخادم

### خطأ: "Plan not found"
**الحل:** استخدم فقط `plan_id` من: `free`, `weekly`, `pro`

---

## 📞 الدعم

للمزيد من التفاصيل حول Volet API:
- https://volet.app/api/documentation
- https://volet.app/merchant/guide

للمزيد عن AdvCash SCI:
- https://advcash.com/en/sci-integration

---

**تاريخ التحديث:** 8 أغسطس 2026
**الإصدار:** v2.0
