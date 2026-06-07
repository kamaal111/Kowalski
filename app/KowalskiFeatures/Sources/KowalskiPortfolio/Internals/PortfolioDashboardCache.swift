//
//  PortfolioDashboardCache.swift
//  KowalskiFeatures
//
//  Created by OpenAI Codex on 6/7/26.
//

import CryptoKit
import Foundation
import KowalskiClient

struct PortfolioDashboardCache {
    private let directoryURL: URL
    private let fileManager: FileManager = .default
    private let decoder = JSONDecoder()
    private let encoder = JSONEncoder()

    init(directoryURL: URL? = nil) {
        if let directoryURL {
            self.directoryURL = directoryURL
        } else {
            let cachesDirectory = fileManager.urls(for: .cachesDirectory, in: .userDomainMask)[0]
            self.directoryURL = cachesDirectory
                .appending(path: "Kowalski/PortfolioDashboards", directoryHint: .isDirectory)
        }
    }

    func read(
        sessionEmail: String,
        currencyCode: String,
        period: KowalskiPortfolioDashboardPeriod,
    ) -> CachedPortfolioDashboard? {
        let fileURL = cacheFileURL(sessionEmail: sessionEmail, currencyCode: currencyCode, period: period)
        guard fileManager.fileExists(atPath: fileURL.path()) else { return nil }

        func cleanUpCorruptFile() -> CachedPortfolioDashboard? {
            try? removeFile(at: fileURL)
            return nil
        }

        let data: Data
        do {
            data = try Data(contentsOf: fileURL)
        } catch {
            return cleanUpCorruptFile()
        }

        let cachedDashboard: CachedPortfolioDashboard
        do {
            cachedDashboard = try decoder.decode(CachedPortfolioDashboard.self, from: data)
        } catch {
            return cleanUpCorruptFile()
        }

        guard cachedDashboard.sessionEmail == sessionEmail else { return cleanUpCorruptFile() }
        guard cachedDashboard.currencyCode == currencyCode else { return cleanUpCorruptFile() }
        guard cachedDashboard.period == period else { return cleanUpCorruptFile() }

        return cachedDashboard
    }

    func write(_ cachedDashboard: CachedPortfolioDashboard) throws {
        try fileManager.createDirectory(at: directoryURL, withIntermediateDirectories: true)
        let fileURL = cacheFileURL(
            sessionEmail: cachedDashboard.sessionEmail,
            currencyCode: cachedDashboard.currencyCode,
            period: cachedDashboard.period,
        )
        let data = try encoder.encode(cachedDashboard)
        try data.write(to: fileURL, options: .atomic)
    }

    func cacheFileURL(
        sessionEmail: String,
        currencyCode: String,
        period: KowalskiPortfolioDashboardPeriod,
    ) -> URL {
        let fileName = cacheFileName(sessionEmail: sessionEmail, currencyCode: currencyCode, period: period)

        return directoryURL.appending(path: fileName, directoryHint: .notDirectory)
    }

    private func cacheFileName(
        sessionEmail: String,
        currencyCode: String,
        period: KowalskiPortfolioDashboardPeriod,
    ) -> String {
        let scope = "\(sessionEmail)|\(currencyCode)|\(period.rawValue)"
        let digest = SHA256.hash(data: Data(scope.utf8)).hexString

        return "\(digest).json"
    }

    private func removeFile(at url: URL) throws {
        guard fileManager.fileExists(atPath: url.path()) else { return }

        try fileManager.removeItem(at: url)
    }
}
