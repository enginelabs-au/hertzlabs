import {Alert} from 'react-native';
import {formatPromoCodeDisplay} from '../monetization/promoCodeFormat';
import {promoCodeNoun} from '../monetization/storePromoCopy';

type Options = {
  title: string;
  code: string;
  onRedeem?: () => void;
  onCopy?: (formatted: string) => void;
};

/** Shows allocated store offer code and optional Redeem action. */
export function showStoreOfferAlert({title, code, onRedeem, onCopy}: Options): void {
  const formatted = formatPromoCodeDisplay(code);
  onCopy?.(formatted);

  const buttons: Array<{text: string; onPress?: () => void; style?: 'cancel' | 'default' | 'destructive'}> = [
    {text: 'OK', style: 'cancel'},
  ];
  if (onRedeem != null) {
    buttons.unshift({text: 'Redeem now', onPress: onRedeem});
  }

  Alert.alert(
    title,
    `Your ${promoCodeNoun()}:\n\n${formatted}\n\nTap Redeem now to open your store, or copy the code from Promos → Redeem.`,
    buttons,
  );
}
