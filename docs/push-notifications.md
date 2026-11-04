# Push Notifications Configuration

This document describes the environment variables required for broadcast push notifications.

## Overview

Broadcast push notifications allow operators to send emergency alerts directly to devices. The system supports both Android (via FCM) and iOS (via APNs).

## Required Secrets

### Firebase Cloud Messaging (Android)

- `FCM_SERVICE_ACCOUNT_JSON`: Firebase service account JSON (complete JSON string with private key)

### Apple Push Notification Service (iOS)

- `APNS_KEY_P8`: APNs authentication key in P8 format (complete key content including header and footer)
- `APNS_KEY_ID`: APNs key identifier (10-character string)
- `APNS_TEAM_ID`: Apple Developer Team ID (10-character string)
- `APNS_BUNDLE_ID`: iOS app bundle identifier (e.g., `com.suleymantarsuslu.sosmesh`)
- `APNS_PRODUCTION`: Set to `true` for production APNs endpoint, `false` for sandbox (default: `false`)

## Behavior

- If environment variables are missing, push notifications are disabled (feature-flagged off)
- One structured warning is logged at startup if credentials are missing
- Invalid/unregistered tokens are automatically removed on 404/410/UNREGISTERED errors
- Push failures are silent (never crash the application)
- Tokens and notification content are never logged

## Security Notes

- Store all secrets in secure environment variable storage (e.g., Cursor Cloud Agents > Secrets)
- Never commit credentials to source control
- Rotate credentials regularly following security best practices
