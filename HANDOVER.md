# Handover Document: Kakao Share & Web Fallback

## Date: 2026-03-01

## Current State (As of today)

1. **Kakao SDK Integration in Web Forms**: 
   - `secondhand/index.html`, `jobs/index.html`, and `realestate/index.html` were updated to successfully integrate the Kakao JavaScript SDK (`Kakao.Share.sendDefault`).
   - The forms now properly capture the dynamically generated Firebase Document ID when a new item is submitted.
   - The Kakao Share payload was updated to construct a link pointing to `download.html` using the template: `https://chaovietnam-login.web.app/download.html?type=[itemType]&id=[itemId]`.

2. **App Deep Linking**:
   - `download.html` was initially modified to act as a deep link router, attempting to launch the React Native Expo app using the custom URI scheme `chaovietnam://[type]/[id]`, with a fallback to the Google Play Store.
   - The Expo React Native App (`App.js`, `ItemDetailScreen.js`, `JobDetailScreen.js`, `RealEstateDetailScreen.js`) was updated to correctly handle incoming deep links, parsing the ID and fetching the document from Firestore to display the detail view directly.

## New Requirement & Pending Tasks

After testing, the user clarified a critical constraint: **Assume the user does NOT have the app installed, and the app installation should NOT be forced.** 
When a user clicks the Kakao Share card inside a KakaoTalk open chat, the link will open in the Kakao in-app browser. The goal is to **display the complete item details independently within that web browser**, instead of immediately attempting deep linking or redirecting to the Play Store.

### Next Steps for Tomorrow:
1. **Develop Web Detail Pages**:
   - Create a new web page (e.g., `detail.html` or expand `download.html`) hosted on Firebase Hosting.
   - This page must parse the `type` and `id` URL parameters.
   - It needs to connect to Firebase Firestore, fetch the specific document, and dynamically render a UI similar to the app's detail screens.
2. **Update Kakao Share Links**:
   - Ensure the URLs in the Kakao Share payloads (`webUrl` and `mobileWebUrl`) point to this new web detail page rather than the old deep-link redirection logic.
3. **Optional App Banner**:
   - Inside the web detail page, we can add an optional button like "Open in App" or "Download App" for users who want to use the app, while keeping the main content fully accessible on the web.

## Git Status
All progress up to this point has been committed to the local Git repository under the message `"Save state: Kakao share and deep linking setup, pending web fallback"`.
