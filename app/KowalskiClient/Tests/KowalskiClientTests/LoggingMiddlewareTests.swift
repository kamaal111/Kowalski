//
//  LoggingMiddlewareTests.swift
//  KowalskiClient
//
//  Created by Codex on 4/3/26.
//

import Foundation
@testable import KowalskiClient
import Testing

@Suite("Logging Middleware Tests")
struct LoggingMiddlewareTests {
    @Test
    func `Token refresh response body should redact token before logging`() throws {
        let responseBody = BodyLoggingPolicy.BodyLog.complete(
            data: Data(#"{"token":"secret-token","expiresAt":"2026-04-03T12:00:00Z"}"#.utf8),
        )

        let sanitizedBody = LoggingMiddleware.sanitizeResponseBodyForLogging(
            responseBody,
            requestPath: "/app-api/auth/token",
        )

        let sanitizedData = try #require(bodyData(from: sanitizedBody))
        let parsedPayload = try jsonDictionary(from: sanitizedData)
        let sanitizedPayload = try #require(parsedPayload)

        #expect(sanitizedPayload["token"] as? String == "<redacted>")
        #expect(sanitizedPayload["expiresAt"] as? String == "2026-04-03T12:00:00Z")
    }

    @Test
    func `Other response bodies should remain unchanged`() {
        let responseBody = BodyLoggingPolicy.BodyLog.complete(data: Data(#"{"token":"secret-token"}"#.utf8))

        let sanitizedBody = LoggingMiddleware.sanitizeResponseBodyForLogging(
            responseBody,
            requestPath: "/app-api/auth/session",
        )

        #expect(sanitizedBody == responseBody)
    }

    private func bodyData(from bodyLog: BodyLoggingPolicy.BodyLog) -> Data? {
        guard case let .complete(data) = bodyLog else { return nil }
        return data
    }

    private func jsonDictionary(from data: Data) throws -> [String: Any]? {
        try JSONSerialization.jsonObject(with: data) as? [String: Any]
    }
}
