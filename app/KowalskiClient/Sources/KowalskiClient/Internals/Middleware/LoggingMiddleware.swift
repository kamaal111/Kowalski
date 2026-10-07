//
//  LoggingMiddleware.swift
//  KowalskiClient
//
//  Created by Kamaal M Farah on 11/15/25.
//

import Foundation
import HTTPTypes
import KamaalLogger
import OpenAPIRuntime

private let defaultPath = "<nil>"
private let authPath = "/app-api/auth"

private let logger = KamaalLogger(from: LoggingMiddleware.self, failOnError: true)

struct LoggingMiddleware {
    let bodyLoggingPolicy: BodyLoggingPolicy
}

extension LoggingMiddleware: ClientMiddleware {
    func intercept(
        _ request: HTTPRequest,
        body: HTTPBody?,
        baseURL: URL,
        operationID _: String,
        next: @Sendable (HTTPRequest, HTTPBody?, URL) async throws -> (HTTPResponse, HTTPBody?),
    ) async throws -> (HTTPResponse, HTTPBody?) {
        let clock = ContinuousClock()
        let start = clock.now
        let loggingPolicy = policy(for: request.path)
        let (requestBodyToLog, requestBodyForNext) = await loggingPolicy.process(body)
        logBody(request: request, requestBody: requestBodyToLog)

        let (response, responseBody): (HTTPResponse, HTTPBody?)
        do {
            (response, responseBody) = try await next(request, requestBodyForNext, baseURL)
        } catch {
            let elapsedTime = start.duration(to: clock.now)
            logFailure(request: request, failedWith: error, elapsedTime: elapsedTime)
            throw error
        }

        let (responseBodyToLog, responseBodyForNext) = await loggingPolicy.process(responseBody)
        let elapsedTime = start.duration(to: clock.now)
        logResponse(request: request, response: response, responseBody: responseBodyToLog, elapsedTime: elapsedTime)
        return (response, responseBodyForNext)
    }

    private func logBody(request: HTTPRequest, requestBody: BodyLoggingPolicy.BodyLog) {
        logger.debug("Request: \(request.method) \(Self.pathForLogging(request.path)) body: \(requestBody)")
    }

    private func logResponse(
        request: HTTPRequest,
        response: HTTPResponse,
        responseBody: BodyLoggingPolicy.BodyLog,
        elapsedTime: Duration,
    ) {
        let sanitizedBody = Self.sanitizeResponseBodyForLogging(responseBody, requestPath: request.path)
        logger.debug(
            "Response: \(request.method) \(Self.pathForLogging(request.path)) \(response.status)"
                + " in \(Self.formatElapsedTime(elapsedTime)) body: \(sanitizedBody)",
        )
    }

    private func logFailure(request: HTTPRequest, failedWith error: any Error, elapsedTime: Duration) {
        let errorDescription = Self.isAuthPath(request.path)
            ? String(reflecting: type(of: error))
            : error.localizedDescription
        logger.warning(
            "Request failed: \(request.method) \(Self.pathForLogging(request.path))"
                + " in \(Self.formatElapsedTime(elapsedTime))."
                + " Error: \(errorDescription)",
        )
    }

    static func sanitizeResponseBodyForLogging(
        _ responseBody: BodyLoggingPolicy.BodyLog,
        requestPath: String?,
    ) -> BodyLoggingPolicy.BodyLog {
        guard isAuthPath(requestPath) else { return responseBody }
        return responseBody == .none ? .none : .redacted
    }

    func policy(for requestPath: String?) -> BodyLoggingPolicy {
        Self.isAuthPath(requestPath) ? .never : bodyLoggingPolicy
    }

    static func pathForLogging(_ requestPath: String?) -> String {
        guard let requestPath else { return defaultPath }
        guard isAuthPath(requestPath) else { return requestPath }
        return String(requestPath.prefix { $0 != "?" && $0 != "#" })
    }

    private static func isAuthPath(_ requestPath: String?) -> Bool {
        guard let requestPath else { return true }
        let path = requestPath.prefix { $0 != "?" && $0 != "#" }
        return path == authPath || path.hasPrefix("\(authPath)/")
    }

    static func formatElapsedTime(_ elapsedTime: Duration) -> String {
        let milliseconds = elapsedTime.components.seconds * 1000
            + elapsedTime.components.attoseconds / 1_000_000_000_000_000
        return "\(milliseconds)ms"
    }
}
