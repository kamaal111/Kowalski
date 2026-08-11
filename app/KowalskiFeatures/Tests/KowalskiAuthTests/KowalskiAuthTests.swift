//
//  KowalskiAuthTests.swift
//  KowalskiFeatures
//
//  Created by Copilot on 4/5/26.
//

import Foundation
import HTTPTypes
@testable import KowalskiAuth
@testable import KowalskiClient
import KowalskiModels
import OpenAPIRuntime
import Testing

@MainActor
@Suite("Auth Feature Tests")
struct KowalskiAuthTests {
    @Test
    func `Update preferred currency should refresh the effective currency after a successful save`() async throws {
        let transport = QueuedResponseTransport(
            responses: [.json(status: .ok, body: sessionResponseBody(preferredCurrency: "EUR"))],
        )
        let client = try makeKowalskiClient(transport: transport)
        let auth = KowalskiAuth.testing(client: client, session: makeSession(preferredCurrency: .USD))

        try await auth.updatePreferredCurrency(.EUR).get()

        #expect(auth.effectiveCurrency == .EUR)
    }

    @Test
    func `Load session should seed locale currency when no preference is saved`() async throws {
        let previousLocaleCurrencyProvider = KowalskiAuth.localeCurrencyProvider
        KowalskiAuth.localeCurrencyProvider = { .EUR }
        defer { KowalskiAuth.localeCurrencyProvider = previousLocaleCurrencyProvider }

        let transport = QueuedResponseTransport(
            responses: [
                .json(
                    status: .ok,
                    body: sessionResponseBody(preferredCurrency: "USD", hasPreferredCurrencyPreference: false),
                ),
                .json(status: .ok, body: sessionResponseBody(preferredCurrency: "EUR")),
            ],
        )
        let client = try makeKowalskiClient(transport: transport)
        let auth = KowalskiAuth.testing(client: client)

        try await auth.loadSession().get()

        #expect(auth.effectiveCurrency == .EUR)
        #expect(transport.capturedRequests.last?.path == "/app-api/auth/preferences")
    }

    @Test
    func `Authentication lifecycle loads the enriched session once`() async throws {
        let transport = QueuedResponseTransport(
            responses: [.json(status: .ok, body: sessionResponseBody(preferredCurrency: "USD"))],
        )
        let client = try makeKowalskiClient(
            transport: transport,
            withCredentials: true,
        )
        let auth = KowalskiAuth.testing(client: client, tracksSessionStates: true)

        await yield(until: { auth.session != nil })

        #expect(auth.session?.preferredCurrency == .USD)
        #expect(transport.capturedRequests.count == 1)
        #expect(transport.capturedRequests.first?.path == "/app-api/auth/session")
    }
}

private func makeKowalskiClient(
    transport: some ClientTransport,
    withCredentials: Bool = false,
) throws -> KowalskiClient {
    let generatedClient = try Client(serverURL: #require(URL(string: "https://api.example.com")), transport: transport)

    return KowalskiClient.testing(client: generatedClient, withCredentials: withCredentials)
}

private func makeSession(preferredCurrency: KowalskiCurrency) -> UserSession {
    UserSession(
        name: "Test User",
        email: "test@example.com",
        expiresAt: Date(timeIntervalSince1970: 1_767_139_200),
        preferredCurrency: preferredCurrency,
        hasPreferredCurrencyPreference: true,
    )
}

private func sessionResponseBody(preferredCurrency: String, hasPreferredCurrencyPreference: Bool = true) -> Data {
    Data(
        """
        {
          "session": {
            "expires_at": "2025-12-31T00:00:00Z",
            "created_at": "2025-01-01T00:00:00Z",
            "updated_at": "2025-04-01T00:00:00Z"
          },
          "user": {
            "id": "550e8400-e29b-41d4-a716-446655440000",
            "name": "Test User",
            "email": "test@example.com",
            "email_verified": true,
            "created_at": "2025-01-01T00:00:00Z",
            "preferred_currency": "\(preferredCurrency)",
            "has_preferred_currency_preference": \(hasPreferredCurrencyPreference)
          }
        }
        """.utf8,
    )
}

// MARK: - Transport

private final class QueuedResponseTransport: ClientTransport, @unchecked Sendable {
    private let responses: [QueuedResponse]
    private(set) var capturedRequests: [HTTPRequest] = []
    private var nextResponseIndex = 0

    init(responses: [QueuedResponse]) {
        self.responses = responses
    }

    func send(
        _ request: HTTPRequest,
        body _: HTTPBody?,
        baseURL _: URL,
        operationID _: String,
    ) async throws -> (HTTPResponse, HTTPBody?) {
        capturedRequests.append(request)

        let index = nextResponseIndex
        nextResponseIndex += 1
        guard responses.indices.contains(index) else {
            return (HTTPResponse(status: .internalServerError), nil)
        }

        let queued = responses[index]
        let headerFields = HTTPFields([HTTPField(name: .contentType, value: "application/json")])

        return (HTTPResponse(status: queued.status, headerFields: headerFields), HTTPBody(queued.body))
    }
}

private struct QueuedResponse {
    let status: HTTPResponse.Status
    let body: Data

    static func json(status: HTTPResponse.Status, body: Data) -> QueuedResponse {
        QueuedResponse(status: status, body: body)
    }
}

@MainActor
private func yield(until condition: @MainActor () -> Bool, iterations: Int = 1000) async {
    var count = 0
    while !condition(), count < iterations {
        await Task.yield()
        count += 1
    }
}
