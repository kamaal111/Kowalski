//
//  MockClientTransport.swift
//  KowalskiClient
//
//  Created by OpenAI Codex on 3/29/26.
//

import Foundation
import HTTPTypes
@testable import KowalskiClient
import OpenAPIRuntime

final class MockClientTransport: ClientTransport, @unchecked Sendable {
    private let queuedResponses: [QueuedResponse]
    private(set) var capturedRequests: [HTTPRequest] = []
    private var nextResponseIndex = 0

    init(queuedResponses: [QueuedResponse]) {
        self.queuedResponses = queuedResponses
    }

    func send(
        _ request: HTTPRequest,
        body _: HTTPBody?,
        baseURL _: URL,
        operationID _: String,
    ) async throws -> (HTTPResponse, HTTPBody?) {
        capturedRequests.append(request)

        let responseIndex = nextResponseIndex
        nextResponseIndex += 1
        guard queuedResponses.indices.contains(responseIndex) else {
            return (HTTPResponse(status: .internalServerError), nil)
        }
        let queuedResponse = queuedResponses[responseIndex]

        let headerFields = HTTPFields([
            HTTPField(name: .contentType, value: queuedResponse.contentType)
        ])
        let response = HTTPResponse(status: queuedResponse.status, headerFields: headerFields)
        let body = queuedResponse.body.map(HTTPBody.init)

        return (response, body)
    }
}

struct QueuedResponse {
    let status: HTTPResponse.Status
    let contentType: String
    let body: Data?

    init(status: HTTPResponse.Status, contentType: String = "application/json", body: Data? = nil) {
        self.status = status
        self.contentType = contentType
        self.body = body
    }
}
