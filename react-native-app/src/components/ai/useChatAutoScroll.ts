import {useCallback, useEffect, useRef} from 'react';
import type {ScrollView} from 'react-native';

/** Keeps nested chat ScrollViews pinned to the latest message. */
export function useChatAutoScroll(messageCount: number, loading: boolean) {
  const chatScrollRef = useRef<ScrollView>(null);

  const scrollChatToBottom = useCallback((animated = true) => {
    requestAnimationFrame(() => {
      chatScrollRef.current?.scrollToEnd({animated});
    });
  }, []);

  useEffect(() => {
    if (messageCount > 0 || loading) {
      scrollChatToBottom(true);
    }
  }, [loading, messageCount, scrollChatToBottom]);

  const onChatContentSizeChange = useCallback(() => {
    scrollChatToBottom(true);
  }, [scrollChatToBottom]);

  return {chatScrollRef, onChatContentSizeChange};
}
