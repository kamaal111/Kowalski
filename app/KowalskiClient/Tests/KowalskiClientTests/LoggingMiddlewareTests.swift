//
//  LoggingMiddlewareTests.swift
//  KowalskiClient
//
//  Created by Codex on 4/3/26.
//

import Foundation
@testable import KowalskiClient
import OpenAPIRuntime
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

    @Test
    func `Elapsed time should format as milliseconds`() {
        let elapsedTime = Duration.seconds(1) + .milliseconds(250)

        let formattedElapsedTime = LoggingMiddleware.formatElapsedTime(elapsedTime)

        #expect(formattedElapsedTime == "1250ms")
    }

    @Test
    func `Unknown response body larger than log limit should log exact byte count instead of unknown length`() async {
        let responseData = Data(repeating: 0, count: 2048)
        let responseBody = HTTPBody(responseData, length: .unknown)

        let processedBody = await BodyLoggingPolicy.upTo(maxBytes: 1024).process(
            responseBody,
        ).bodyToLog

        #expect(processedBody == .tooManyBytesToLog(byteCount: 2048))
    }

    @Test
    func `Unknown response body within log limit should be logged and replayed`() async throws {
        let responseData = Data(#"{"net_worth":{"currency":"USD","value":0}}"#.utf8)
        let responseBody = HTTPBody(responseData, length: .unknown)

        let processedBody = await BodyLoggingPolicy.upTo(maxBytes: 1024).process(
            responseBody,
        )

        #expect(processedBody.bodyToLog == .complete(data: responseData))
        let replayedBody = try #require(processedBody.bodyForNext)
        let replayedData = try await Data(collecting: replayedBody, upTo: 1024)
        #expect(replayedData == responseData)
    }

    private func bodyData(from bodyLog: BodyLoggingPolicy.BodyLog) -> Data? {
        guard case let .complete(data) = bodyLog else { return nil }
        return data
    }

    private func jsonDictionary(from data: Data) throws -> [String: Any]? {
        try JSONSerialization.jsonObject(with: data) as? [String: Any]
    }
}
