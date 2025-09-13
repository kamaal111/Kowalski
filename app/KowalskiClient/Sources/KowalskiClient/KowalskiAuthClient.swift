//
//  KowalskiAuthClient.swift
//  KowalskiClient
//
//  Created by Kamaal M Farah on 9/13/25.
//

public struct KowalskiAuthClient: Sendable {
    private let client: Client

    init(client: Client) {
        self.client = client
    }

    public func signIn(email: String, password: String) async throws {
        let response = try await client.postApiAuthSignInEmail(body: .json(.init(email: email, password: password)))
        print("response", response)
        switch response {
        case let .undocumented(statusCode, payload):
            break
        case let .unauthorized(payload):
            break
        case let .badRequest(payload):
            break
        case let .ok(payload):
            break
        }
    }
}
