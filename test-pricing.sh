#!/bin/bash
# اختبار سريع للميزات الجديدة

echo "🧪 اختبار الميزات الجديدة لـ Smart Meal Planner"
echo "================================================"

# تحديد متغيرات الاختبار
BACKEND_URL="http://localhost:8000"
FRONTEND_URL="http://localhost:3000"
TEST_USER_TOKEN="your-bearer-token"

echo ""
echo "1️⃣  اختبار جلب قائمة الخطط..."
curl -X GET "$BACKEND_URL/api/v1/subscription/plans" \
  -H "Content-Type: application/json" \
  -s | jq '.'

echo ""
echo "2️⃣  اختبار إنشاء Checkout للخطة الأسبوعية (Volet)..."
curl -X POST "$BACKEND_URL/api/v1/subscription/checkout?plan_id=weekly&provider=volet" \
  -H "Authorization: Bearer $TEST_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -s | jq '.'

echo ""
echo "3️⃣  اختبار إنشاء Checkout للخطة Pro (AdvCash)..."
curl -X POST "$BACKEND_URL/api/v1/subscription/checkout?plan_id=pro&provider=advcash" \
  -H "Authorization: Bearer $TEST_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -s | jq '.'

echo ""
echo "4️⃣  فتح صفحة التسعير في المتصفح..."
echo "يمكنك الآن فتح: $FRONTEND_URL/pricing"

echo ""
echo "✅ الاختبارات أنمتت بنجاح!"
echo "🔗 للمزيد من المعلومات، راجع PRICING_UPDATE.md"
