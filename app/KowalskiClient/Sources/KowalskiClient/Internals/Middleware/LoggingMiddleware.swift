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
private let refreshTokenPath = "/app-api/auth/token"
private let redactedTokenValue = "<redacted>"

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
        let (requestBodyToLog, requestBodyForNext) = await bodyLoggingPolicy.process(body)
        logBody(request: request, requestBody: requestBodyToLog)

        let (response, responseBody): (HTTPResponse, HTTPBody?)
        do {
            (response, responseBody) = try await next(request, requestBodyForNext, baseURL)
        } catch {
            logFailure(request: request, failedWith: error)
            throw error
        }

        let (responseBodyToLog, responseBodyForNext) = await bodyLoggingPolicy.process(responseBody)
        logResponse(request: request, response: response, responseBody: responseBodyToLog)
        return (response, responseBodyForNext)
    }

    private func logBody(request: HTTPRequest, requestBody: BodyLoggingPolicy.BodyLog) {
        logger.debug("Request: \(request.method) \(request.path ?? defaultPath) body: \(requestBody)")
    }

    private func logResponse(request: HTTPRequest, response: HTTPResponse, responseBody: BodyLoggingPolicy.BodyLog) {
        let sanitizedBody = Self.sanitizeResponseBodyForLogging(responseBody, requestPath: request.path)
        logger.debug(
            "Response: \(request.method) \(request.path ?? defaultPath) \(response.status) body: \(sanitizedBody)",
        )
    }

    private func logFailure(request _: HTTPRequest, failedWith error: any Error) {
        logger.warning("Request failed. Error: \(error.localizedDescription)")
    }

    static func sanitizeResponseBodyForLogging(
        _ responseBody: BodyLoggingPolicy.BodyLog,
        requestPath: String?,
    ) -> BodyLoggingPolicy.BodyLog {
        guard requestPath == refreshTokenPath else { return responseBody }
        guard case let .complete(data) = responseBody else { return responseBody }
        guard let redactedData = redactToken(in: data) else { return responseBody }

        return .complete(data: redactedData)
    }

    private static func redactToken(in data: Data) -> Data? {
        guard let jsonObject = try? JSONSerialization.jsonObject(with: data) else { return nil }
        guard var jsonDictionary = jsonObject as? [String: Any] else { return nil }
        guard jsonDictionary["token"] != nil else { return nil }

        jsonDictionary["token"] = redactedTokenValue

        return try? JSONSerialization.data(withJSONObject: jsonDictionary, options: [.sortedKeys])
    }
}
