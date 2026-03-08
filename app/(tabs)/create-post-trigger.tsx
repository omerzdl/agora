// This screen is never navigated to directly.
// Its tab bar button is replaced by the custom FAB in _layout.tsx,
// which immediately opens the /create-post modal instead.
import { View } from 'react-native';

export default function CreatePostTrigger() {
  return <View />;
}

