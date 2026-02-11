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
                    // iOS: url 속성으로 카드만 표시
                    // Android: message로 텍스트 전달 (카카오톡이 자동으로 링크 카드 생성)
                    const shareOptions = Platform.OS === 'ios'
                        ? { url: url, title: title }
                        : { message: `${message}\n\n앱에서 보기 👉 ${url}` };
                    await Share.share(shareOptions);
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
                    const shareOptions = Platform.OS === 'ios'
                        ? { url: url, title: title }
                        : { message: `${message}\n\n앱에서 보기 👉 ${url}` };
                    await Share.share(shareOptions);
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
                // iOS는 url 속성으로 깔끔한 카드 표시
                // Android는 message로 전달 (자동으로 링크 미리보기 생성)
                const shareOptions = Platform.OS === 'ios'
                    ? { url: url, title: title }
                    : { message: `${message}\n\n앱에서 보기 👉 ${url}` };
                await Share.share(shareOptions);
                break;
        }
        return { success: true };
    } catch (error) {
        console.error('공유 실패:', error);
        return { success: false, error: error };
    }
};
