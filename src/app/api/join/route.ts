import { NextResponse } from 'next/server';

// Define runtime as edge
export const runtime = 'edge';

// Placeholder URLs - Replace with actual App Store / Play Store links
const IOS_STORE_URL = 'https://apps.apple.com/app/example-app/id123456789'; // TODO: Replace
const ANDROID_STORE_URL = 'https://play.google.com/store/apps/details?id=com.example.app'; // TODO: Replace
const DEEP_LINK_URL = 'pawapp://home';

export async function GET(request: Request) {
  // Could add logic here based on request headers (e.g., User-Agent)
  // but keeping simple for now. Client-side will handle UA detection.

  return NextResponse.json({
    deepLink: DEEP_LINK_URL,
    iosStoreUrl: IOS_STORE_URL,
    androidStoreUrl: ANDROID_STORE_URL,
  });
} 