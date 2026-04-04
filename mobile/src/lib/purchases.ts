import { Platform } from 'react-native';
import {
  setup,
  initConnection,
  getSubscriptions,
  requestSubscription,
  finishTransaction,
  getAvailablePurchases,
  purchaseUpdatedListener,
  purchaseErrorListener,
  ErrorCode,
  SubscriptionPlatform,
  type Subscription,
  type SubscriptionPurchase,
  type Purchase,
  type RequestSubscription,
} from 'react-native-iap';

/**
 * Sahiplik aboneliği — App Store Connect ve Google Play’deki subscription product ID ile birebir aynı olmalı.
 * Projede başka subscription product ID kullanılmaz.
 */
export const OWNER_SUBSCRIPTION_PRODUCT_ID = 'com.menubank.premium.monthly';

function isOwnerSku(productId: string): boolean {
  return productId === OWNER_SUBSCRIPTION_PRODUCT_ID;
}

function buildSubscriptionRequest(sub: Subscription): RequestSubscription {
  if (sub.platform === SubscriptionPlatform.android) {
    const offer = sub.subscriptionOfferDetails?.[0];
    if (!offer?.offerToken) {
      throw new Error(
        'Google Play: abonelik teklifi bulunamadı. Play Console’da base plan ve fiyat tanımlı olduğundan emin olun.',
      );
    }
    return {
      subscriptionOffers: [{ sku: sub.productId, offerToken: offer.offerToken }],
    };
  }
  if (sub.platform === SubscriptionPlatform.amazon) {
    return { sku: sub.productId };
  }
  return { sku: sub.productId };
}

function normalizePurchaseResult(
  result: SubscriptionPurchase | SubscriptionPurchase[] | null | void,
): SubscriptionPurchase[] {
  if (result == null) return [];
  return Array.isArray(result) ? result : [result];
}

export async function setupPurchases() {
  if (Platform.OS === 'web') return;
  try {
    if (Platform.OS === 'ios') {
      setup({ storekitMode: 'STOREKIT_HYBRID_MODE' });
    }
    await initConnection();
  } catch (e) {
    console.warn('[IAP] initConnection failed:', e);
  }
}

export async function identifyPurchasesUser(_userId: string) {}

export async function clearPurchasesUser() {}

export async function fetchProducts(): Promise<Subscription[]> {
  if (Platform.OS === 'web') return [];
  try {
    await initConnection();
    return await getSubscriptions({ skus: [OWNER_SUBSCRIPTION_PRODUCT_ID] });
  } catch (e) {
    console.warn('[IAP] getSubscriptions failed:', OWNER_SUBSCRIPTION_PRODUCT_ID, e);
    return [];
  }
}

/**
 * Aboneliği Apple / Google üzerinden başlatır; başarılı olursa finishTransaction.
 * @returns true = satın alındı, false = kullanıcı iptal / zaman aşımı
 */
export async function purchaseProduct(sub: Subscription): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  await initConnection();
  const request = buildSubscriptionRequest(sub);

  return new Promise((resolve, reject) => {
    let done = false;
    let delivering = false;
    let purchaseSub: ReturnType<typeof purchaseUpdatedListener>;
    let errorSub: ReturnType<typeof purchaseErrorListener>;
    let timeoutId: ReturnType<typeof setTimeout>;

    const close = () => {
      clearTimeout(timeoutId);
      purchaseSub?.remove();
      errorSub?.remove();
    };

    const finishOk = (ok: boolean, err?: unknown) => {
      if (done) return;
      done = true;
      close();
      if (err != null) reject(err);
      else resolve(ok);
    };

    const deliverPurchase = async (purchase: Purchase) => {
      if (done || delivering || !isOwnerSku(purchase.productId)) return;
      delivering = true;
      try {
        await finishTransaction({ purchase, isConsumable: false });
        finishOk(true);
      } catch (e) {
        finishOk(false, e);
      } finally {
        delivering = false;
      }
    };

    timeoutId = setTimeout(() => finishOk(false), 120_000);

    purchaseSub = purchaseUpdatedListener((purchase: Purchase) => {
      void deliverPurchase(purchase);
    });

    errorSub = purchaseErrorListener((error) => {
      if (error.code === ErrorCode.E_USER_CANCELLED) {
        finishOk(false);
        return;
      }
      finishOk(false, error);
    });

    requestSubscription(request)
      .then((result) => {
        const list = normalizePurchaseResult(result);
        const direct = list.find((p) => isOwnerSku(p.productId));
        if (direct) void deliverPurchase(direct);
      })
      .catch((e: { code?: string }) => {
        if (e?.code === ErrorCode.E_USER_CANCELLED) finishOk(false);
        else finishOk(false, e);
      });
  });
}

export async function checkProStatus(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    await initConnection();
    const purchases = await getAvailablePurchases({ onlyIncludeActiveItems: true });
    return purchases.some((p) => isOwnerSku(p.productId));
  } catch {
    return false;
  }
}

export async function restorePurchases(): Promise<boolean> {
  return checkProStatus();
}
