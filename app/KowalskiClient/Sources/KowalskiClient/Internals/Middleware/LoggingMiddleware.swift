//
//  LoggingMiddleware.swift
//  KowalskiClient
//
//  Created by Kamaal M Farah on 11/15/25.
//

import HTTPTypes
import Foundation
import KamaalLogger
import OpenAPIRuntime

private let DEFAULT_PATH = "<nil>"

private let logger = KamaalLogger(from: LoggingMiddleware.self, failOnError: true)

struct LoggingMiddleware {
    let bodyLoggingPolicy: BodyLoggingPolicy
}

extension LoggingMiddleware: ClientMiddleware {
    func intercept(
        _ request: HTTPRequest,
        body: HTTPBody?,
        baseURL: URL,
        operationID: String,
        next: @Sendable (HTTPRequest, HTTPBody?, URL) async throws -> (HTTPResponse, HTTPBody?)
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
        logger.debug("Request: \(request.method) \(request.path ?? DEFAULT_PATH) body: \(requestBody)")
    }

    private func logResponse(request: HTTPRequest, response: HTTPResponse, responseBody: BodyLoggingPolicy.BodyLog) {
        logger.debug(
            "Response: \(request.method) \(request.path ?? DEFAULT_PATH) \(response.status) body: \(responseBody)"
        )
    }

    private func logFailure(request: HTTPRequest, failedWith error: any Error) {
        logger.warning("Request failed. Error: \(error.localizedDescription)")
    }
}
