import { Share, Linking, Platform } from 'react-native';

/**
 * SNS 공유 서비스
 * @param {string} platform - 'kakao' | 'facebook' | 'threads' | 'zalo' | 'sms' | 'more'
 * @param {string} title - 공유 제목
 * @param {string} message - 공유 메시지
 * @param {string} url - 공유 URL
 */
export const shareToSNS = async (platform, title, message, url) => {
    const encodedUrl = encodeURIComponent(url);
    const encodedMessage = encodeURIComponent(message);
    const encodedTitle = encodeURIComponent(title);

    try {
        switch (platform) {
            case 'kakao':
                const canOpenKakao = await Linking.canOpenURL('kakaolink://');
                if (canOpenKakao) {
                    // 카카오톡으로 공유 (URL만 전달 - 카드만 표시)
                    await Share.share({
                        message: url,  // URL만 전달
                        title: title
                    });
                } else {
                    return { success: false, error: 'kakao_not_installed' };
                }
                break;

            case 'facebook':
                const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
                await Linking.openURL(fbUrl);
                break;

            case 'threads':
                const threadsUrl = `https://www.threads.net/intent/post?text=${encodedMessage}`;
                await Linking.openURL(threadsUrl).catch(() => {
                    Linking.openURL(`https://www.threads.net/`);
                });
                break;

            case 'zalo':
                const zaloInstalled = await Linking.canOpenURL('zalo://');
                if (zaloInstalled) {
                    await Share.share({
                        message: url,  // URL만 전달
                        title: title
                    });
                } else {
                    return { success: false, error: 'zalo_not_installed' };
                }
                break;

            case 'sms':
                const smsBody = `${message}\n\n${url}`;
                const smsUrl = Platform.OS === 'ios'
                    ? `sms:&body=${encodeURIComponent(smsBody)}`
                    : `sms:?body=${encodeURIComponent(smsBody)}`;
                await Linking.openURL(smsUrl);
                break;

            case 'more':
            default:
                // 기본 공유 시트 (URL만 전달)
                await Share.share({
                    message: url,  // URL만 전달
                    title: title,
                    url: url
                });
                break;
        }
        return { success: true };
    } catch (error) {
        console.error('공유 실패:', error);
        return { success: false, error: error };
    }
};
