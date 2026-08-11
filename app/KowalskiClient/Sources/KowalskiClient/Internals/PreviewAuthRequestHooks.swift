//
//  PreviewAuthRequestHooks.swift
//  KowalskiClient
//

import Foundation
import KamaalAuth

/// Canned hooks for SwiftUI previews and `KowalskiClient.testing(...)`. Never reaches the network.
struct PreviewAuthRequestHooks: AuthRequestHooks {
    private static let session = AuthSession(
        id: "preview-user",
        name: "Yami Sukehiro",
        email: "yami@bulls.io",
        emailVerified: true,
        createdAt: Date(timeIntervalSince1970: 1_700_000_000),
        expiresAt: Date(timeIntervalSince1970: 1_762_088_596),
    )

    func signUp(_: SignUpPayload) async -> AuthRequestOutcome<AuthCredentialHeaders> {
        .success(Self.credentials())
    }

    func signIn(_: SignInPayload) async -> AuthRequestOutcome<AuthCredentialHeaders> {
        .success(Self.credentials())
    }

    func signOut() async -> AuthRequestOutcome<Void> {
        .success(())
    }

    func session() async -> AuthRequestOutcome<AuthSession> {
        .success(Self.session)
    }

    func issueToken() async -> AuthRequestOutcome<AuthCredentialHeaders> {
        .success(Self.credentials())
    }

    private static func credentials() -> AuthCredentialHeaders {
        AuthCredentialHeaders(
            authToken: "preview.jwt.token",
            authTokenExpiresInSeconds: 86400,
            sessionToken: "preview_session_token",
            sessionUpdateAgeSeconds: 86400,
        )
    }
}
