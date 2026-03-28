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
        logger.debug(
            "Response: \(request.method) \(request.path ?? defaultPath) \(response.status) body: \(responseBody)",
        )
    }

    private func logFailure(request _: HTTPRequest, failedWith error: any Error) {
        logger.warning("Request failed. Error: \(error.localizedDescription)")
    }
}
