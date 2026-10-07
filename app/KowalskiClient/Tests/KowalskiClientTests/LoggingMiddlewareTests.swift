//
//  LoggingMiddlewareTests.swift
//  KowalskiClient
//
//  Created by Codex on 4/3/26.
//

import Foundation
import HTTPTypes
@testable import KowalskiClient
import OpenAPIRuntime
import Testing

@Suite("Logging Middleware Tests")
struct LoggingMiddlewareTests {
    @Test
    func `Token refresh response body should be fully redacted before logging`() {
        let responseBody = BodyLoggingPolicy.BodyLog.complete(
            data: Data(#"{"token":"secret-token","expiresAt":"2026-04-03T12:00:00Z"}"#.utf8),
        )

        let sanitizedBody = LoggingMiddleware.sanitizeResponseBodyForLogging(
            responseBody,
            requestPath: "/app-api/auth/token",
        )

        #expect(sanitizedBody == .redacted)
    }

    @Test(arguments: [
        "/app-api/auth/sign-in/email",
        "/app-api/auth/sign-up/email",
        "/app-api/auth/session",
        "/app-api/auth/reset-password?email=private@example.com",
        "/app-api/auth"
    ])
    func `Authentication bodies are never logged even when malformed`(path: String) async throws {
        let middleware = LoggingMiddleware(bodyLoggingPolicy: .upTo(maxBytes: 1024))
        let data = Data(#"{"email":"private@example.com","password":"private-password"}"#.utf8)
        let processed = await middleware.policy(for: path).process(HTTPBody(data))

        #expect(processed.bodyToLog == .redacted)
        let forwarded = try #require(processed.bodyForNext)
        #expect(try await Data(collecting: forwarded, upTo: 1024) == data)
        #expect(LoggingMiddleware.sanitizeResponseBodyForLogging(.complete(data: data), requestPath: path) == .redacted)
        #expect(LoggingMiddleware.sanitizeResponseBodyForLogging(
            .complete(data: Data("malformed private-password".utf8)),
            requestPath: path,
        ) == .redacted)
        #expect(!LoggingMiddleware.pathForLogging(path).contains("private@example.com"))
    }

    @Test
    func `Authentication middleware forwards credential bodies unchanged`() async throws {
        let middleware = LoggingMiddleware(bodyLoggingPolicy: .upTo(maxBytes: 1024))
        let requestData = Data(#"{"email":"private@example.com","password":"private-password"}"#.utf8)
        let responseData = Data(#"{"user":{"email":"private@example.com"},"token":"private-token"}"#.utf8)
        let request = HTTPRequest(
            method: .post,
            scheme: "https",
            authority: "example.com",
            path: "/app-api/auth/sign-in/email",
        )

        let (_, responseBody) = try await middleware.intercept(
            request,
            body: HTTPBody(requestData),
            baseURL: #require(URL(string: "https://example.com")),
            operationID: "signIn",
        ) { _, body, _ in
            let forwarded = try #require(body)
            #expect(try await Data(collecting: forwarded, upTo: 1024) == requestData)
            return (HTTPResponse(status: .ok), HTTPBody(responseData))
        }

        let forwardedResponse = try #require(responseBody)
        #expect(try await Data(collecting: forwardedResponse, upTo: 1024) == responseData)
    }

    @Test
    func `Other response bodies should remain unchanged`() {
        let responseBody = BodyLoggingPolicy.BodyLog.complete(data: Data(#"{"token":"secret-token"}"#.utf8))

        let sanitizedBody = LoggingMiddleware.sanitizeResponseBodyForLogging(
            responseBody,
            requestPath: "/app-api/portfolio",
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
}
