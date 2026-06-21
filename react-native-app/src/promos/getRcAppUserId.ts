import Purchases from 'react-native-purchases';

/** RevenueCat app user id for server-side promo grants (best-effort). */
export async function getRcAppUserId(): Promise<string | null> {
  try {
    const info = await Purchases.getCustomerInfo();
    const id = info.originalAppUserId?.trim();
    return id != null && id.length > 0 ? id : null;
  } catch {
    return null;
  }
}
