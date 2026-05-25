//
//  KowalskiPortfolioGrowthChartView.swift
//  KowalskiFeatures
//
//  Created by OpenAI Codex on 5/25/26.
//

import Charts
import KowalskiDesignSystem
import SwiftUI

struct KowalskiPortfolioGrowthChartView: View {
    let growth: PortfolioGrowthOverTime
    @Binding var selectedGrowthPoint: PortfolioGrowthPoint?

    var body: some View {
        Chart {
            ForEach(growth.points.indices, id: \.self) { index in
                let point = growth.points[index]

                LineMark(
                    x: .value("Date", point.date),
                    y: .value("Value", point.value),
                )
                .interpolationMethod(.catmullRom)
                .foregroundStyle(Color.accentColor)

                PointMark(
                    x: .value("Date", point.date),
                    y: .value("Value", point.value),
                )
                .foregroundStyle(Color.accentColor)
            }

            if let selectedGrowthPoint {
                RuleMark(x: .value("Selected date", selectedGrowthPoint.date))
                    .foregroundStyle(.secondary)
                    .lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 4]))

                PointMark(
                    x: .value("Selected date", selectedGrowthPoint.date),
                    y: .value("Selected value", selectedGrowthPoint.value),
                )
                .symbolSize(80)
                .foregroundStyle(Color.accentColor)
                .annotation(position: .top, alignment: .center) {
                    KowalskiPortfolioGrowthChartAnnotationView(
                        point: selectedGrowthPoint,
                        currency: growth.currency,
                    )
                }
            }
        }
        .chartXAxis {
            AxisMarks(values: .automatic(desiredCount: 4))
        }
        .chartYAxis {
            AxisMarks(position: .leading)
        }
        .chartOverlay { proxy in
            GeometryReader { geometry in
                Rectangle()
                    .fill(.clear)
                    .contentShape(Rectangle())
                    .onContinuousHover { phase in
                        handleHover(phase, proxy: proxy, geometry: geometry)
                    }
            }
        }
        .frame(height: 280)
    }

    private func handleHover(
        _ phase: HoverPhase,
        proxy: ChartProxy,
        geometry: GeometryProxy,
    ) {
        switch phase {
        case let .active(location):
            selectedGrowthPoint = nearestGrowthPoint(
                to: location,
                proxy: proxy,
                geometry: geometry,
            )
        case .ended:
            selectedGrowthPoint = nil
        }
    }

    private func nearestGrowthPoint(
        to location: CGPoint,
        proxy: ChartProxy,
        geometry: GeometryProxy,
    ) -> PortfolioGrowthPoint? {
        guard let plotFrameAnchor = proxy.plotFrame else { return nil }

        let plotFrame = geometry[plotFrameAnchor]
        let plotLocation = CGPoint(x: location.x - plotFrame.origin.x, y: location.y - plotFrame.origin.y)
        guard plotLocation.x >= 0,
              plotLocation.x <= plotFrame.width,
              let hoveredDate = proxy.value(atX: plotLocation.x, as: Date.self)
        else {
            return nil
        }

        return growth.points.min { left, right in
            abs(left.date.timeIntervalSince(hoveredDate)) < abs(right.date.timeIntervalSince(hoveredDate))
        }
    }
}
