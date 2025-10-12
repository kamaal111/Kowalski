//
//  KowalskiScene.swift
//  KowalskiApp
//
//  Created by Kamaal M Farah on 9/7/25.
//

import SwiftUI
import KowalskiAuth

public struct KowalskiScene: Scene {
    @State private var auth = KowalskiAuth()

    public init() { }

    public var body: some Scene {
        WindowGroup {
            ContentView()
                .kowalskiAuth(auth)
        }
    }
}
