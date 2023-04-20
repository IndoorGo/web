import { type NextPage } from "next";
import Head from "next/head";
import Link from "next/link";
import {
  TransformWrapper,
  TransformComponent,
  ReactZoomPanPinchRef,
  ReactZoomPanPinchContentRef,
} from "react-zoom-pan-pinch";
import joint, {
  dia,
  shapes,
  routers,
  connectionStrategies,
  linkTools,
} from "jointjs";
import React, { useEffect, useRef } from "react";
import { join } from "path";

import "jointjs/dist/joint.css";
import "jointjs/css/layout.css";
import "jointjs/css/themes/modern.css";

import graphlib from "graphlib";

import LayoutWithSidebar from "~/components/LayoutWithSidebar";
import { v4 as uuidv4 } from "uuid";

export const Controls = ({
  zoomIn,
  zoomOut,
  resetTransform,
  centerView,
}: {
  zoomIn: () => void;
  zoomOut: () => void;
  resetTransform: () => void;
  centerView: () => void;
}) => (
  <div className="grid grid-cols-4 gap-2">
    <button
      type="button"
      className="rounded-md bg-gray-200 p-2"
      onClick={() => zoomIn()}
    >
      Зум +
    </button>
    <button
      type="button"
      className="rounded-md bg-gray-200 p-2"
      onClick={() => zoomOut()}
    >
      Зум -
    </button>
    <button
      type="button"
      className="rounded-md bg-gray-200 p-2"
      onClick={() => resetTransform()}
    >
      Восстановить
    </button>
    <button
      type="button"
      className="rounded-md bg-gray-200 p-2"
      onClick={() => centerView()}
    >
      Центер
    </button>
  </div>
);

const MouseMode = {
  NONE: "none",
  CREATE_PORT: "create-port",
};

class PriorityQueue<T> {
  private elements: { priority: number; value: T }[];

  constructor() {
    this.elements = [];
  }

  enqueue(value: T, priority: number) {
    this.elements.push({ value, priority });
    this.elements.sort((a, b) => a.priority - b.priority);
  }

  dequeue(): { value: T; priority: number } {
    return this.elements.shift();
  }

  isEmpty(): boolean {
    return this.elements.length === 0;
  }
}

const MapRoutesCration: NextPage = () => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const panZoomRef = useRef<ReactZoomPanPinchRef>(null);
  const cells: shapes.devs.Model[] = [];

  const [panZoomEnabled, setPanZoomEnabled] = React.useState(false);

  const [scale, setScale] = React.useState(1.0);

  const [graph, setGraph] = React.useState<dia.Graph>(
    new dia.Graph(
      {},
      {
        cellNamespace: {
          devs: shapes.devs,
        },
      }
    )
  );

  const [paper, setPaper] = React.useState<dia.Paper>();

  const getLinkToolsView = () => {
    const verticesTool = new linkTools.Vertices({
      redundancyRemoval: false,
      snapRadius: 10,
      vertexAdding: false,
    });
    const segmentsTool = new linkTools.Segments();
    const sourceArrowheadTool = new linkTools.SourceArrowhead();
    const targetArrowheadTool = new linkTools.TargetArrowhead();
    const sourceAnchorTool = new linkTools.SourceAnchor();
    const targetAnchorTool = new linkTools.TargetAnchor();
    const boundaryTool = new linkTools.Boundary();
    const removeButton = new linkTools.Remove();

    return new dia.ToolsView({
      tools: [
        verticesTool,
        segmentsTool,
        sourceArrowheadTool,
        targetArrowheadTool,
        sourceAnchorTool,
        targetAnchorTool,
        boundaryTool,
        removeButton,
      ],
    });
  };

  const changeMouseMode = (mode: string) => {
    if (mode === MouseMode.CREATE_PORT) {
      // change cursor
      document.body.style.cursor = "crosshair";
    }

    if (mode === MouseMode.NONE) {
      // change cursor
      document.body.style.cursor = "default";
    }
  };

  const handlePointerMove = (cellView: dia.CellView) => {
    const rect = cellView.el.getBoundingClientRect();
    const elements = document.elementsFromPoint(rect.left, rect.top);

    for (const el of elements) {
      const closest = el.closest("[data-room]");

      if (closest) {
        const room = closest.getAttribute("data-room");
        if (room) {
          cellView.model.attr(".label/text", room.split("__")[1]);
        }
      }
    }
  };

  const handleBlankPointerDown = React.useCallback(
    (evt: dia.Event, x: number, y: number) => {
      if (document.body.style.cursor !== "crosshair") return;
      if (evt.button !== 0) return;
      if (panZoomEnabled) return;

      const cell = new shapes.devs.Model({
        type: "RoomPoint",
        position: { x: x, y: y },
        attrs: {
          ".body": {
            width: "60",
            height: "60",
            fill: "rgba(0,0,0,0)",
            stroke: "none",
          },
          ".label": {
            text: "Точка аудитории",
          },
        },

        portMarkup:
          '<g class="port">' + '<circle class="port-body" r="10"/>' + "</g>",

        inPorts: [""],
      });

      cell.translate(-40, -40);

      cells.push(cell);

      graph.addCells(cells);

      changeMouseMode(MouseMode.NONE);
    },
    [panZoomEnabled]
  );

  useEffect(() => {
    const paper = new dia.Paper({
      cellViewNamespace: {
        devs: shapes.devs,
      },
      width: "100%",
      height: "100%",

      model: graph,
      async: true,

      gridSize: 5,
      drawGrid: { name: "mesh" },
      sorting: dia.Paper.sorting.APPROX,
      background: { color: "#F3F7F6" },

      connectionStrategy: connectionStrategies.pinAbsolute,

      validateConnection: function (cellViewS, magnetS, cellViewT, magnetT) {
        if (magnetS !== magnetT) {
          return true;
        }

        return false;
      },

      defaultLink: new shapes.devs.Link({
        attrs: {
          ".connection": {
            stroke: "#000000",
            "stroke-width": 1,
          },
          ".marker-target": {
            fill: "#000000",
            d: "M 10 0 L 0 5 L 10 10 z",
          },
          ".marker-arrowheads": {
            display: "none",
          },
          ".link-tools": {
            display: "none",
          },
          ".marker-vertices": {
            display: "none",
          },
        },
      }),
    });

    if (canvasRef.current) {
      if (canvasRef.current.childNodes.length === 0)
        canvasRef.current.appendChild(paper.el);
    }

    paper.on("blank:pointerdown", function (evt, x, y) {
      setPanZoomEnabled(true);
    });

    paper.on("cell:pointerup blank:pointerup", function (cellView, event) {
      setPanZoomEnabled(false);
    });

    paper.on("cell:pointermove", handlePointerMove);

    paper.on("blank:pointerdown", handleBlankPointerDown);

    paper.on("link:mouseenter", function (linkView) {
      linkView.addTools(getLinkToolsView());
    });

    paper.on("link:mouseleave", function (linkView) {
      linkView.removeTools();
    });

    setPaper(paper);
  }, [canvasRef]);

  useEffect(() => {
    // Change styles (sizez) of tools, links, vertices, etc. on zoom

    // tool-remove is a <g> element with a <circle> and a <path> inside.
    // We need to change the size of the <circle> and the <path> to make the
    // tool bigger or smaller.
    const toolRemoves = document.querySelectorAll(".tool-remove");

    // marker-vertices is a <g> element with a <circle>  element (.marker-vertex),
    // and two <path> elements (.marker-vertex-remove-area and .marker-vertex-remove)
    const markerVertices = document.querySelectorAll(".marker-vertices");

    // marker-arrowhead-group is a <g> element with <path> inside (arrow) (.marker-arrowhead)
    const markerArrowheads = document.querySelectorAll(
      ".marker-arrowhead-group"
    );

    console.log(markerVertices);

    toolRemoves.forEach((el) => {
      const circle = el.querySelector("circle");
      const path = el.querySelector("path");

      if (circle && path) {
        circle.setAttribute("r", `${10 / scale}`);

        // // change transform scale of the path
        // path.setAttribute("transform", `scale(${1 / scale})`);
        // change position of the path to make it centered in the circle and update scale
        path.setAttribute(
          "transform",
          `translate(${-13 / scale}, ${-13 / scale}) scale(${0.8 / scale})`
        );
      }
    });

    markerVertices.forEach((el) => {
      const circle = el.querySelector("circle");
      const path = el.querySelector("path");

      if (circle && path) {
        circle.setAttribute("r", `${10 / scale}`);

        // // The .marker-vertex-remove path is a cross. Default transform="scale(.8) translate(9.5, -37)"
        // //
        // path.setAttribute("transform", `translate(${9.5 / scale}, ${-37 / scale}) scale(${0.8 / scale})`);
      }
    });

    markerArrowheads.forEach((el) => {
      const path = el.querySelector("path");

      if (path) {
        // change transform scale of the path
        path.setAttribute(
          "transform",
          `scale(${1 / scale}) translate(${0 / scale}, ${-10 / scale})`
        );
      }
    });
  }, [scale]);

  const exportGraph = () => {
    const json = normalizeGraph(graph);

    // Download the file
    const element = document.createElement("a");
    const file = new Blob([JSON.stringify(json)], {
      type: "application/json",
    });
    element.href = URL.createObjectURL(file);
    element.download = "graph.json";
    document.body.appendChild(element); // Required for this to work in FireFox
    element.click();
  };

  const getDistance = (x1: number, y1: number, x2: number, y2: number) => {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  };

  const normalizeGraph = (graph: dia.Graph) => {
    const normalizedGraph = graph.toJSON();
    const cells = normalizedGraph.cells;

    for (const cell of cells) {
      const links = graph.getConnectedLinks(cell);

      links.forEach((link) => {
        const sourceId = link.source().id?.toString();
        const targetId = link.target().id?.toString();

        console.log("sourceId", sourceId);
        console.log("targetId", targetId);

        // Не учитываем "тупиковые" ребра и ребра, которые не соединяют две вершины
        if (!sourceId || !targetId) return;

        const vertices = link.vertices().map((vertex) => {
          return {
            x: vertex.x,
            y: vertex.y,
          };
        });

        console.log("vertices", vertices);

        const newLinks = [];
        const newVertices = [];

        // Разделяем ребро на отрезки
        if (vertices.length > 0) {
          for (let i = 0; i < vertices.length; i++) {
            const currentVertex = vertices[i];
            if (!currentVertex) return;

            const newVertexId = uuidv4();
            // Создаем новую вершину
            const newVertex = {
              type: "Vertex",
              x: currentVertex.x,
              y: currentVertex.y,
              id: newVertexId,
            };

            newVertices.push(newVertex);

            if (i === 0) {
              // Создаем новое ребро, соединяющее начальную точку с первой вершиной
              const newLink = {
                type: "Link",
                source: { id: sourceId },
                target: { id: newVertexId },
                id: uuidv4(),
                vertices: [],
              };
              newLinks.push(newLink);
            } else if (i === vertices.length - 1) {
              // Создаем новое ребро, соединяющее последнюю вершину с конечной точкой
              const newLink = {
                type: "Link",
                source: { id: newVertices[i - 1].id },
                target: { id: targetId },
                id: uuidv4(),
                vertices: [],
              };
              newLinks.push(newLink);
            } else {
              // Создаем новое ребро, соединяющее текущую вершину с предыдущей
              const newLink = {
                type: "Link",
                source: { id: newVertices[i - 1].id },
                target: { id: newVertexId },
                id: uuidv4(),
                vertices: [],
              };
              newLinks.push(newLink);
            }
          }

          // Удаляем старый Link из графа
          normalizedGraph.cells = normalizedGraph.cells.filter(
            (cell) => cell.id !== link.id
          );

          // Добавляем новые вершины и ребра
          normalizedGraph.cells = [...normalizedGraph.cells, ...newVertices];
          normalizedGraph.cells = [...normalizedGraph.cells, ...newLinks];
        }
      });
    }

    return normalizedGraph;
  };

  const findShortestPath = (
    graph: dia.Graph,
    startLabel: string,
    endLabel: string
  ) => {
    const cells = graph.getCells();

    const startCell = cells.find((cell) => {
      if (cell.attributes.attrs === undefined) return false;
      if (cell.attributes.attrs[".label"] === undefined) return false;
      return cell.attributes.attrs[".label"].text === startLabel;
    });

    const endCell = cells.find((cell) => {
      if (cell.attributes.attrs === undefined) return false;
      if (cell.attributes.attrs[".label"] === undefined) return false;
      return cell.attributes.attrs[".label"].text === endLabel;
    });

    if (!startCell || !endCell) return;

    const startId = startCell.id.toString();
    const endId = endCell.id.toString();

    const normalizedGraph = normalizeGraph(graph);

    const vertices = normalizedGraph.cells.filter(
      (cell) => cell.type === "Vertex"
    );
    const edges = normalizedGraph.cells.filter((cell) => cell.type === "Link");

    console.log(vertices)
    console.log(edges)

    // Create an adjacency list for the graph
    const adjacencyList = {};
    for (const vertex of vertices) {
      const vertexId = vertex.id.toString();
      adjacencyList[vertexId] = [];
      for (const edge of edges) {
        const sourceId = edge.source.id.toString();
        const targetId = edge.target.id.toString();
        if (sourceId === vertexId) {
          const distance = getDistance(
            vertex.position.x,
            vertex.position.y,
            edge.target.point.x,
            edge.target.point.y
          );
          adjacencyList[vertexId].push({ targetId, distance });
        } else if (targetId === vertexId) {
          const distance = getDistance(
            vertex.position.x,
            vertex.position.y,
            edge.source.point.x,
            edge.source.point.y
          );
          adjacencyList[vertexId].push({ targetId: sourceId, distance });
        }
      }
    }

    // Dijkstra's algorithm
    const distances = {};
    const visited = {};
    const previous = {};
    const queue = new PriorityQueue();

    for (const vertex of vertices) {
      const vertexId = vertex.id.toString();
      if (vertexId === startId) {
        distances[vertexId] = 0;
        queue.enqueue(vertexId, 0);
      } else {
        distances[vertexId] = Infinity;
        queue.enqueue(vertexId, Infinity);
      }
      previous[vertexId] = null;
    }

    while (!queue.isEmpty()) {
      const currentVertexId = queue.dequeue().element;
      visited[currentVertexId] = true;

      if (currentVertexId === endId) {
        const path = [];
        let current = endId;
        while (current !== null) {
          path.unshift(current);
          current = previous[current];
        }
        console.log(path);
        return path;
      }

      const neighbors = adjacencyList[currentVertexId];
      for (const neighbor of neighbors) {
        const neighborId = neighbor.targetId;
        if (visited[neighborId]) continue;
        const distance = neighbor.distance;
        const currentDistance = distances[currentVertexId];
        const tentativeDistance = currentDistance + distance;
        if (tentativeDistance < distances[neighborId]) {
          distances[neighborId] = tentativeDistance;
          previous[neighborId] = currentVertexId;
          queue.enqueue(neighborId, tentativeDistance);
        }
      }
    }

    return null;
  };
  const [startLabel, setStartLabel] = React.useState("");
  const [endLabel, setEndLabel] = React.useState("");

  return (
    <>
      <Head>
        <title>Содание новигационных маршрутов</title>
        <meta name="description" content="Создание новых маршрутов" />
      </Head>
      <main className="h-full w-full">
        <LayoutWithSidebar>
          <button
            className="m-2 h-10 rounded bg-blue-500 p-2 text-white"
            onClick={() => {
              changeMouseMode(MouseMode.CREATE_PORT);
            }}
          >
            Добавить маршрут
          </button>
          <button
            className="m-2 h-10 rounded bg-blue-500 p-2 text-white"
            onClick={exportGraph}
          >
            Экспорт карты
          </button>

          <div>
            <input
              className="m-2 h-10 rounded bg-blue-500 p-2 text-white"
              value={startLabel}
              onChange={(e) => setStartLabel(e.target.value)}
            />
            <input
              className="m-2 h-10 rounded bg-blue-500 p-2 text-white"
              value={endLabel}
              onChange={(e) => setEndLabel(e.target.value)}
            />

            <button
              className="m-2 h-10 rounded bg-blue-500 p-2 text-white"
              onClick={() => {
                console.log(findShortestPath(graph, startLabel, endLabel));
              }}
            >
              Рисовать маршрут
            </button>
          </div>

          <div id="map" className="h-full w-full overflow-auto">
            <TransformWrapper
              initialScale={1}
              panning={{ disabled: !panZoomEnabled }}
              wheel={{ disabled: !panZoomEnabled }}
              onTransformed={(e) => {
                if (e.state.scale !== scale) {
                  setScale(e.state.scale);
                }
              }}
              onZoom={(e) => {
                if (e.state.scale !== scale) {
                  setScale(e.state.scale);
                }
              }}
            >
              {({ zoomIn, zoomOut, resetTransform, centerView, ...rest }) => (
                <React.Fragment>
                  <Controls
                    zoomIn={zoomIn}
                    zoomOut={zoomOut}
                    resetTransform={resetTransform}
                    centerView={centerView}
                  />
                  <TransformComponent>
                    <div
                      className="absolute z-10 h-full w-full
                    "
                      ref={canvasRef}
                    />
                    <svg
                      className="z-1 relative h-full w-full"
                      width="1152"
                      height="1026"
                      viewBox="0 0 1152 1026"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <g>
                        <rect
                          width="1152"
                          height="1024"
                          transform="translate(0 2)"
                          fill="#F8F8F8"
                        />
                        <rect
                          x="136"
                          y="826"
                          width="880"
                          height="64"
                          rx="12"
                          fill="#DADADA"
                        />
                        <rect
                          x="136"
                          y="890"
                          width="826"
                          height="64"
                          rx="12"
                          transform="rotate(-90 136 890)"
                          fill="#DADADA"
                        />
                        <rect
                          x="136"
                          y="202"
                          width="64"
                          height="400"
                          rx="12"
                          transform="rotate(-90 136 202)"
                          fill="#DADADA"
                        />
                        <rect
                          x="952"
                          y="890"
                          width="754"
                          height="64"
                          rx="12"
                          transform="rotate(-90 952 890)"
                          fill="#DADADA"
                        />
                        <g data-room="В-78__Г-213">
                          <rect
                            y="898"
                            width="176"
                            height="128"
                            rx="12"
                            fill="#2563EB"
                          />
                          <path
                            d="M52.1875 973H47.4531V950.453H61.9844V954.359H52.1875V973ZM73.7812 965.828H63.5156V961.844H73.7812V965.828ZM77.0625 957.234C77.0625 955.099 77.8333 953.354 79.375 952C80.9271 950.635 82.9323 949.953 85.3906 949.953C87.7552 949.953 89.6823 950.568 91.1719 951.797C92.6615 953.016 93.4062 954.573 93.4062 956.469C93.4062 957.146 93.3021 957.802 93.0938 958.438C92.8958 959.062 92.5729 959.693 92.125 960.328C91.6875 960.953 91.2448 961.521 90.7969 962.031C90.349 962.531 89.7656 963.141 89.0469 963.859L83.5469 969.156V969.25H93.7188V973H77.3281V969.828L85.8281 961.641C86.974 960.495 87.7552 959.573 88.1719 958.875C88.599 958.177 88.8125 957.438 88.8125 956.656C88.8125 955.802 88.474 955.083 87.7969 954.5C87.1198 953.917 86.2656 953.625 85.2344 953.625C84.1406 953.625 83.2344 953.969 82.5156 954.656C81.7969 955.333 81.4375 956.193 81.4375 957.234V957.312H77.0625V957.234ZM102.281 973V954.781H102.188L96.4375 958.75V954.5L102.266 950.453H106.953V973H102.281ZM117.5 963.156V959.75H120.234C121.307 959.75 122.177 959.458 122.844 958.875C123.51 958.292 123.844 957.536 123.844 956.609C123.844 955.682 123.526 954.948 122.891 954.406C122.255 953.854 121.359 953.578 120.203 953.578C119.109 953.578 118.224 953.875 117.547 954.469C116.87 955.062 116.5 955.854 116.438 956.844H112.094C112.177 954.75 112.974 953.078 114.484 951.828C115.995 950.578 117.969 949.953 120.406 949.953C122.76 949.953 124.661 950.505 126.109 951.609C127.568 952.714 128.297 954.167 128.297 955.969C128.297 957.333 127.87 958.49 127.016 959.438C126.161 960.385 125.036 960.984 123.641 961.234V961.328C125.339 961.474 126.682 962.031 127.672 963C128.672 963.958 129.172 965.214 129.172 966.766C129.172 968.776 128.344 970.401 126.688 971.641C125.042 972.88 122.911 973.5 120.297 973.5C117.766 973.5 115.719 972.865 114.156 971.594C112.604 970.323 111.771 968.641 111.656 966.547H116.172C116.245 967.505 116.651 968.271 117.391 968.844C118.141 969.417 119.13 969.703 120.359 969.703C121.536 969.703 122.5 969.401 123.25 968.797C124 968.193 124.375 967.417 124.375 966.469C124.375 965.438 124.01 964.63 123.281 964.047C122.552 963.453 121.552 963.156 120.281 963.156H117.5Z"
                            fill="white"
                          />
                        </g>
                        <g data-room="В-78__Г-208">
                          <rect
                            x="960"
                            y="898"
                            width="192"
                            height="128"
                            rx="12"
                            fill="#2563EB"
                          />
                          <path
                            d="M1017.14 973H1012.41V950.453H1026.94V954.359H1017.14V973ZM1038.73 965.828H1028.47V961.844H1038.73V965.828ZM1042.02 957.234C1042.02 955.099 1042.79 953.354 1044.33 952C1045.88 950.635 1047.89 949.953 1050.34 949.953C1052.71 949.953 1054.64 950.568 1056.12 951.797C1057.61 953.016 1058.36 954.573 1058.36 956.469C1058.36 957.146 1058.26 957.802 1058.05 958.438C1057.85 959.062 1057.53 959.693 1057.08 960.328C1056.64 960.953 1056.2 961.521 1055.75 962.031C1055.3 962.531 1054.72 963.141 1054 963.859L1048.5 969.156V969.25H1058.67V973H1042.28V969.828L1050.78 961.641C1051.93 960.495 1052.71 959.573 1053.12 958.875C1053.55 958.177 1053.77 957.438 1053.77 956.656C1053.77 955.802 1053.43 955.083 1052.75 954.5C1052.07 953.917 1051.22 953.625 1050.19 953.625C1049.09 953.625 1048.19 953.969 1047.47 954.656C1046.75 955.333 1046.39 956.193 1046.39 957.234V957.312H1042.02V957.234ZM1077 970.328C1075.39 972.443 1073.16 973.5 1070.33 973.5C1067.49 973.5 1065.27 972.448 1063.64 970.344C1062.02 968.229 1061.2 965.344 1061.2 961.688C1061.2 958.052 1062.02 955.188 1063.64 953.094C1065.28 950.99 1067.51 949.938 1070.33 949.938C1073.15 949.938 1075.38 950.984 1077 953.078C1078.62 955.172 1079.44 958.036 1079.44 961.672C1079.44 965.318 1078.62 968.203 1077 970.328ZM1067.14 967.609C1067.91 969.016 1068.97 969.719 1070.33 969.719C1071.68 969.719 1072.74 969.021 1073.5 967.625C1074.26 966.219 1074.64 964.24 1074.64 961.688C1074.64 959.156 1074.26 957.198 1073.48 955.812C1072.72 954.417 1071.67 953.719 1070.33 953.719C1068.98 953.719 1067.93 954.417 1067.16 955.812C1066.39 957.208 1066 959.167 1066 961.688C1066 964.229 1066.38 966.203 1067.14 967.609ZM1091.19 973.5C1088.46 973.5 1086.25 972.891 1084.56 971.672C1082.89 970.443 1082.05 968.849 1082.05 966.891C1082.05 965.411 1082.54 964.146 1083.52 963.094C1084.49 962.031 1085.77 961.37 1087.34 961.109V961.016C1086.03 960.714 1084.97 960.099 1084.16 959.172C1083.35 958.234 1082.95 957.146 1082.95 955.906C1082.95 954.177 1083.72 952.755 1085.27 951.641C1086.81 950.516 1088.78 949.953 1091.19 949.953C1093.6 949.953 1095.58 950.516 1097.11 951.641C1098.64 952.755 1099.41 954.182 1099.41 955.922C1099.41 957.141 1099.01 958.219 1098.2 959.156C1097.4 960.083 1096.34 960.703 1095.03 961.016V961.109C1096.61 961.38 1097.89 962.047 1098.86 963.109C1099.84 964.161 1100.33 965.427 1100.33 966.906C1100.33 968.865 1099.48 970.453 1097.78 971.672C1096.09 972.891 1093.9 973.5 1091.19 973.5ZM1088.14 969.078C1088.93 969.734 1089.95 970.062 1091.19 970.062C1092.43 970.062 1093.44 969.734 1094.22 969.078C1095 968.411 1095.39 967.568 1095.39 966.547C1095.39 965.526 1095 964.688 1094.22 964.031C1093.44 963.365 1092.43 963.031 1091.19 963.031C1089.95 963.031 1088.93 963.365 1088.14 964.031C1087.36 964.688 1086.97 965.526 1086.97 966.547C1086.97 967.568 1087.36 968.411 1088.14 969.078ZM1088.62 958.719C1089.29 959.302 1090.15 959.594 1091.19 959.594C1092.23 959.594 1093.08 959.302 1093.75 958.719C1094.42 958.125 1094.75 957.38 1094.75 956.484C1094.75 955.578 1094.42 954.833 1093.75 954.25C1093.08 953.656 1092.23 953.359 1091.19 953.359C1090.15 953.359 1089.29 953.656 1088.62 954.25C1087.96 954.833 1087.62 955.578 1087.62 956.484C1087.62 957.391 1087.96 958.135 1088.62 958.719Z"
                            fill="white"
                          />
                        </g>
                        <g data-room="В-78__Г-202">
                          <rect
                            x="1024"
                            y="2"
                            width="128"
                            height="204"
                            rx="12"
                            fill="#2563EB"
                          />
                          <path
                            d="M1050 115H1045.27V92.4531H1059.8V96.3594H1050V115ZM1071.59 107.828H1061.33V103.844H1071.59V107.828ZM1074.88 99.2344C1074.88 97.099 1075.65 95.3542 1077.19 94C1078.74 92.6354 1080.74 91.9531 1083.2 91.9531C1085.57 91.9531 1087.49 92.5677 1088.98 93.7969C1090.47 95.0156 1091.22 96.5729 1091.22 98.4688C1091.22 99.1458 1091.11 99.8021 1090.91 100.438C1090.71 101.062 1090.39 101.693 1089.94 102.328C1089.5 102.953 1089.06 103.521 1088.61 104.031C1088.16 104.531 1087.58 105.141 1086.86 105.859L1081.36 111.156V111.25H1091.53V115H1075.14V111.828L1083.64 103.641C1084.79 102.495 1085.57 101.573 1085.98 100.875C1086.41 100.177 1086.62 99.4375 1086.62 98.6562C1086.62 97.8021 1086.29 97.0833 1085.61 96.5C1084.93 95.9167 1084.08 95.625 1083.05 95.625C1081.95 95.625 1081.05 95.9688 1080.33 96.6562C1079.61 97.3333 1079.25 98.1927 1079.25 99.2344V99.3125H1074.88V99.2344ZM1109.86 112.328C1108.24 114.443 1106.02 115.5 1103.19 115.5C1100.35 115.5 1098.12 114.448 1096.5 112.344C1094.88 110.229 1094.06 107.344 1094.06 103.688C1094.06 100.052 1094.88 97.1875 1096.5 95.0938C1098.14 92.9896 1100.36 91.9375 1103.19 91.9375C1106.01 91.9375 1108.23 92.9844 1109.86 95.0781C1111.48 97.1719 1112.3 100.036 1112.3 103.672C1112.3 107.318 1111.48 110.203 1109.86 112.328ZM1100 109.609C1100.77 111.016 1101.83 111.719 1103.19 111.719C1104.54 111.719 1105.6 111.021 1106.36 109.625C1107.12 108.219 1107.5 106.24 1107.5 103.688C1107.5 101.156 1107.11 99.1979 1106.34 97.8125C1105.58 96.4167 1104.53 95.7188 1103.19 95.7188C1101.84 95.7188 1100.79 96.4167 1100.02 97.8125C1099.24 99.2083 1098.86 101.167 1098.86 103.688C1098.86 106.229 1099.24 108.203 1100 109.609ZM1114.78 99.2344C1114.78 97.099 1115.55 95.3542 1117.09 94C1118.65 92.6354 1120.65 91.9531 1123.11 91.9531C1125.47 91.9531 1127.4 92.5677 1128.89 93.7969C1130.38 95.0156 1131.12 96.5729 1131.12 98.4688C1131.12 99.1458 1131.02 99.8021 1130.81 100.438C1130.61 101.062 1130.29 101.693 1129.84 102.328C1129.41 102.953 1128.96 103.521 1128.52 104.031C1128.07 104.531 1127.48 105.141 1126.77 105.859L1121.27 111.156V111.25H1131.44V115H1115.05V111.828L1123.55 103.641C1124.69 102.495 1125.47 101.573 1125.89 100.875C1126.32 100.177 1126.53 99.4375 1126.53 98.6562C1126.53 97.8021 1126.19 97.0833 1125.52 96.5C1124.84 95.9167 1123.98 95.625 1122.95 95.625C1121.86 95.625 1120.95 95.9688 1120.23 96.6562C1119.52 97.3333 1119.16 98.1927 1119.16 99.2344V99.3125H1114.78V99.2344Z"
                            fill="white"
                          />
                        </g>
                        <g data-room="В-78__Г-201-3">
                          <rect
                            x="816"
                            y="2"
                            width="128"
                            height="204"
                            rx="12"
                            fill="#2563EB"
                          />
                          <path
                            d="M826.812 115H822.078V92.4531H836.609V96.3594H826.812V115ZM848.406 107.828H838.141V103.844H848.406V107.828ZM851.688 99.2344C851.688 97.099 852.458 95.3542 854 94C855.552 92.6354 857.557 91.9531 860.016 91.9531C862.38 91.9531 864.307 92.5677 865.797 93.7969C867.286 95.0156 868.031 96.5729 868.031 98.4688C868.031 99.1458 867.927 99.8021 867.719 100.438C867.521 101.062 867.198 101.693 866.75 102.328C866.312 102.953 865.87 103.521 865.422 104.031C864.974 104.531 864.391 105.141 863.672 105.859L858.172 111.156V111.25H868.344V115H851.953V111.828L860.453 103.641C861.599 102.495 862.38 101.573 862.797 100.875C863.224 100.177 863.438 99.4375 863.438 98.6562C863.438 97.8021 863.099 97.0833 862.422 96.5C861.745 95.9167 860.891 95.625 859.859 95.625C858.766 95.625 857.859 95.9688 857.141 96.6562C856.422 97.3333 856.062 98.1927 856.062 99.2344V99.3125H851.688V99.2344ZM886.672 112.328C885.057 114.443 882.833 115.5 880 115.5C877.167 115.5 874.938 114.448 873.312 112.344C871.688 110.229 870.875 107.344 870.875 103.688C870.875 100.052 871.688 97.1875 873.312 95.0938C874.948 92.9896 877.177 91.9375 880 91.9375C882.823 91.9375 885.047 92.9844 886.672 95.0781C888.297 97.1719 889.109 100.036 889.109 103.672C889.109 107.318 888.297 110.203 886.672 112.328ZM876.812 109.609C877.583 111.016 878.646 111.719 880 111.719C881.354 111.719 882.411 111.021 883.172 109.625C883.932 108.219 884.312 106.24 884.312 103.688C884.312 101.156 883.927 99.1979 883.156 97.8125C882.396 96.4167 881.344 95.7188 880 95.7188C878.656 95.7188 877.599 96.4167 876.828 97.8125C876.057 99.2083 875.672 101.167 875.672 103.688C875.672 106.229 876.052 108.203 876.812 109.609ZM897.5 115V96.7812H897.406L891.656 100.75V96.5L897.484 92.4531H902.172V115H897.5ZM917.844 107.828H907.578V103.844H917.844V107.828ZM926.875 105.156V101.75H929.609C930.682 101.75 931.552 101.458 932.219 100.875C932.885 100.292 933.219 99.5365 933.219 98.6094C933.219 97.6823 932.901 96.9479 932.266 96.4062C931.63 95.8542 930.734 95.5781 929.578 95.5781C928.484 95.5781 927.599 95.875 926.922 96.4688C926.245 97.0625 925.875 97.8542 925.812 98.8438H921.469C921.552 96.75 922.349 95.0781 923.859 93.8281C925.37 92.5781 927.344 91.9531 929.781 91.9531C932.135 91.9531 934.036 92.5052 935.484 93.6094C936.943 94.7135 937.672 96.1667 937.672 97.9688C937.672 99.3333 937.245 100.49 936.391 101.438C935.536 102.385 934.411 102.984 933.016 103.234V103.328C934.714 103.474 936.057 104.031 937.047 105C938.047 105.958 938.547 107.214 938.547 108.766C938.547 110.776 937.719 112.401 936.062 113.641C934.417 114.88 932.286 115.5 929.672 115.5C927.141 115.5 925.094 114.865 923.531 113.594C921.979 112.323 921.146 110.641 921.031 108.547H925.547C925.62 109.505 926.026 110.271 926.766 110.844C927.516 111.417 928.505 111.703 929.734 111.703C930.911 111.703 931.875 111.401 932.625 110.797C933.375 110.193 933.75 109.417 933.75 108.469C933.75 107.438 933.385 106.63 932.656 106.047C931.927 105.453 930.927 105.156 929.656 105.156H926.875Z"
                            fill="white"
                          />
                        </g>
                        <g data-room="В-78__Г-201-2">
                          <rect
                            x="680"
                            y="2"
                            width="128"
                            height="204"
                            rx="12"
                            fill="#2563EB"
                          />
                          <path
                            d="M691.234 115H686.5V92.4531H701.031V96.3594H691.234V115ZM712.828 107.828H702.562V103.844H712.828V107.828ZM716.109 99.2344C716.109 97.099 716.88 95.3542 718.422 94C719.974 92.6354 721.979 91.9531 724.438 91.9531C726.802 91.9531 728.729 92.5677 730.219 93.7969C731.708 95.0156 732.453 96.5729 732.453 98.4688C732.453 99.1458 732.349 99.8021 732.141 100.438C731.943 101.062 731.62 101.693 731.172 102.328C730.734 102.953 730.292 103.521 729.844 104.031C729.396 104.531 728.812 105.141 728.094 105.859L722.594 111.156V111.25H732.766V115H716.375V111.828L724.875 103.641C726.021 102.495 726.802 101.573 727.219 100.875C727.646 100.177 727.859 99.4375 727.859 98.6562C727.859 97.8021 727.521 97.0833 726.844 96.5C726.167 95.9167 725.312 95.625 724.281 95.625C723.188 95.625 722.281 95.9688 721.562 96.6562C720.844 97.3333 720.484 98.1927 720.484 99.2344V99.3125H716.109V99.2344ZM751.094 112.328C749.479 114.443 747.255 115.5 744.422 115.5C741.589 115.5 739.359 114.448 737.734 112.344C736.109 110.229 735.297 107.344 735.297 103.688C735.297 100.052 736.109 97.1875 737.734 95.0938C739.37 92.9896 741.599 91.9375 744.422 91.9375C747.245 91.9375 749.469 92.9844 751.094 95.0781C752.719 97.1719 753.531 100.036 753.531 103.672C753.531 107.318 752.719 110.203 751.094 112.328ZM741.234 109.609C742.005 111.016 743.068 111.719 744.422 111.719C745.776 111.719 746.833 111.021 747.594 109.625C748.354 108.219 748.734 106.24 748.734 103.688C748.734 101.156 748.349 99.1979 747.578 97.8125C746.818 96.4167 745.766 95.7188 744.422 95.7188C743.078 95.7188 742.021 96.4167 741.25 97.8125C740.479 99.2083 740.094 101.167 740.094 103.688C740.094 106.229 740.474 108.203 741.234 109.609ZM761.922 115V96.7812H761.828L756.078 100.75V96.5L761.906 92.4531H766.594V115H761.922ZM782.266 107.828H772V103.844H782.266V107.828ZM785.547 99.2344C785.547 97.099 786.318 95.3542 787.859 94C789.411 92.6354 791.417 91.9531 793.875 91.9531C796.24 91.9531 798.167 92.5677 799.656 93.7969C801.146 95.0156 801.891 96.5729 801.891 98.4688C801.891 99.1458 801.786 99.8021 801.578 100.438C801.38 101.062 801.057 101.693 800.609 102.328C800.172 102.953 799.729 103.521 799.281 104.031C798.833 104.531 798.25 105.141 797.531 105.859L792.031 111.156V111.25H802.203V115H785.812V111.828L794.312 103.641C795.458 102.495 796.24 101.573 796.656 100.875C797.083 100.177 797.297 99.4375 797.297 98.6562C797.297 97.8021 796.958 97.0833 796.281 96.5C795.604 95.9167 794.75 95.625 793.719 95.625C792.625 95.625 791.719 95.9688 791 96.6562C790.281 97.3333 789.922 98.1927 789.922 99.2344V99.3125H785.547V99.2344Z"
                            fill="white"
                          />
                        </g>
                        <g data-room="В-78__Г-201-1">
                          <rect
                            x="544"
                            y="2"
                            width="128"
                            height="204"
                            rx="12"
                            fill="#2563EB"
                          />
                          <path
                            d="M557.562 115H552.828V92.4531H567.359V96.3594H557.562V115ZM579.156 107.828H568.891V103.844H579.156V107.828ZM582.438 99.2344C582.438 97.099 583.208 95.3542 584.75 94C586.302 92.6354 588.307 91.9531 590.766 91.9531C593.13 91.9531 595.057 92.5677 596.547 93.7969C598.036 95.0156 598.781 96.5729 598.781 98.4688C598.781 99.1458 598.677 99.8021 598.469 100.438C598.271 101.062 597.948 101.693 597.5 102.328C597.062 102.953 596.62 103.521 596.172 104.031C595.724 104.531 595.141 105.141 594.422 105.859L588.922 111.156V111.25H599.094V115H582.703V111.828L591.203 103.641C592.349 102.495 593.13 101.573 593.547 100.875C593.974 100.177 594.188 99.4375 594.188 98.6562C594.188 97.8021 593.849 97.0833 593.172 96.5C592.495 95.9167 591.641 95.625 590.609 95.625C589.516 95.625 588.609 95.9688 587.891 96.6562C587.172 97.3333 586.812 98.1927 586.812 99.2344V99.3125H582.438V99.2344ZM617.422 112.328C615.807 114.443 613.583 115.5 610.75 115.5C607.917 115.5 605.688 114.448 604.062 112.344C602.438 110.229 601.625 107.344 601.625 103.688C601.625 100.052 602.438 97.1875 604.062 95.0938C605.698 92.9896 607.927 91.9375 610.75 91.9375C613.573 91.9375 615.797 92.9844 617.422 95.0781C619.047 97.1719 619.859 100.036 619.859 103.672C619.859 107.318 619.047 110.203 617.422 112.328ZM607.562 109.609C608.333 111.016 609.396 111.719 610.75 111.719C612.104 111.719 613.161 111.021 613.922 109.625C614.682 108.219 615.062 106.24 615.062 103.688C615.062 101.156 614.677 99.1979 613.906 97.8125C613.146 96.4167 612.094 95.7188 610.75 95.7188C609.406 95.7188 608.349 96.4167 607.578 97.8125C606.807 99.2083 606.422 101.167 606.422 103.688C606.422 106.229 606.802 108.203 607.562 109.609ZM628.25 115V96.7812H628.156L622.406 100.75V96.5L628.234 92.4531H632.922V115H628.25ZM648.594 107.828H638.328V103.844H648.594V107.828ZM657.062 115V96.7812H656.969L651.219 100.75V96.5L657.047 92.4531H661.734V115H657.062Z"
                            fill="white"
                          />
                        </g>
                        <g data-room="В-78__Г-212-1">
                          <rect
                            x="184"
                            y="962"
                            width="128"
                            height="64"
                            rx="12"
                            fill="#2563EB"
                          />
                          <path
                            d="M198.203 1005H193.469V982.453H208V986.359H198.203V1005ZM219.797 997.828H209.531V993.844H219.797V997.828ZM223.078 989.234C223.078 987.099 223.849 985.354 225.391 984C226.943 982.635 228.948 981.953 231.406 981.953C233.771 981.953 235.698 982.568 237.188 983.797C238.677 985.016 239.422 986.573 239.422 988.469C239.422 989.146 239.318 989.802 239.109 990.438C238.911 991.062 238.589 991.693 238.141 992.328C237.703 992.953 237.26 993.521 236.812 994.031C236.365 994.531 235.781 995.141 235.062 995.859L229.562 1001.16V1001.25H239.734V1005H223.344V1001.83L231.844 993.641C232.99 992.495 233.771 991.573 234.188 990.875C234.615 990.177 234.828 989.438 234.828 988.656C234.828 987.802 234.49 987.083 233.812 986.5C233.135 985.917 232.281 985.625 231.25 985.625C230.156 985.625 229.25 985.969 228.531 986.656C227.812 987.333 227.453 988.193 227.453 989.234V989.312H223.078V989.234ZM248.297 1005V986.781H248.203L242.453 990.75V986.5L248.281 982.453H252.969V1005H248.297ZM257.766 989.234C257.766 987.099 258.536 985.354 260.078 984C261.63 982.635 263.635 981.953 266.094 981.953C268.458 981.953 270.385 982.568 271.875 983.797C273.365 985.016 274.109 986.573 274.109 988.469C274.109 989.146 274.005 989.802 273.797 990.438C273.599 991.062 273.276 991.693 272.828 992.328C272.391 992.953 271.948 993.521 271.5 994.031C271.052 994.531 270.469 995.141 269.75 995.859L264.25 1001.16V1001.25H274.422V1005H258.031V1001.83L266.531 993.641C267.677 992.495 268.458 991.573 268.875 990.875C269.302 990.177 269.516 989.438 269.516 988.656C269.516 987.802 269.177 987.083 268.5 986.5C267.823 985.917 266.969 985.625 265.938 985.625C264.844 985.625 263.938 985.969 263.219 986.656C262.5 987.333 262.141 988.193 262.141 989.234V989.312H257.766V989.234ZM287.953 997.828H277.688V993.844H287.953V997.828ZM296.422 1005V986.781H296.328L290.578 990.75V986.5L296.406 982.453H301.094V1005H296.422Z"
                            fill="white"
                          />
                        </g>
                        <g data-room="В-78__Г-214">
                          <rect
                            y="836"
                            width="128"
                            height="54"
                            rx="12"
                            fill="#2563EB"
                          />
                          <path
                            d="M27.8906 874H23.1562V851.453H37.6875V855.359H27.8906V874ZM49.4844 866.828H39.2188V862.844H49.4844V866.828ZM52.7656 858.234C52.7656 856.099 53.5365 854.354 55.0781 853C56.6302 851.635 58.6354 850.953 61.0938 850.953C63.4583 850.953 65.3854 851.568 66.875 852.797C68.3646 854.016 69.1094 855.573 69.1094 857.469C69.1094 858.146 69.0052 858.802 68.7969 859.438C68.599 860.062 68.276 860.693 67.8281 861.328C67.3906 861.953 66.9479 862.521 66.5 863.031C66.0521 863.531 65.4688 864.141 64.75 864.859L59.25 870.156V870.25H69.4219V874H53.0312V870.828L61.5312 862.641C62.6771 861.495 63.4583 860.573 63.875 859.875C64.3021 859.177 64.5156 858.438 64.5156 857.656C64.5156 856.802 64.1771 856.083 63.5 855.5C62.8229 854.917 61.9688 854.625 60.9375 854.625C59.8438 854.625 58.9375 854.969 58.2188 855.656C57.5 856.333 57.1406 857.193 57.1406 858.234V858.312H52.7656V858.234ZM77.9844 874V855.781H77.8906L72.1406 859.75V855.5L77.9688 851.453H82.6562V874H77.9844ZM98.4688 874V869.984H87.25V865.969C89.0833 862.469 92.099 857.63 96.2969 851.453H102.953V866.203H105.891V869.984H102.953V874H98.4688ZM91.3906 866.219V866.344H98.5625V854.797H98.4688C96.7292 857.339 95.3333 859.458 94.2812 861.156C93.2292 862.844 92.2656 864.531 91.3906 866.219Z"
                            fill="white"
                          />
                        </g>
                        <g data-room="В-78__Г-215">
                          <rect
                            y="774"
                            width="128"
                            height="54"
                            rx="12"
                            fill="#2563EB"
                          />
                          <path
                            d="M28.2656 812H23.5312V789.453H38.0625V793.359H28.2656V812ZM49.8594 804.828H39.5938V800.844H49.8594V804.828ZM53.1406 796.234C53.1406 794.099 53.9115 792.354 55.4531 791C57.0052 789.635 59.0104 788.953 61.4688 788.953C63.8333 788.953 65.7604 789.568 67.25 790.797C68.7396 792.016 69.4844 793.573 69.4844 795.469C69.4844 796.146 69.3802 796.802 69.1719 797.438C68.974 798.062 68.651 798.693 68.2031 799.328C67.7656 799.953 67.3229 800.521 66.875 801.031C66.4271 801.531 65.8438 802.141 65.125 802.859L59.625 808.156V808.25H69.7969V812H53.4062V808.828L61.9062 800.641C63.0521 799.495 63.8333 798.573 64.25 797.875C64.6771 797.177 64.8906 796.438 64.8906 795.656C64.8906 794.802 64.5521 794.083 63.875 793.5C63.1979 792.917 62.3438 792.625 61.3125 792.625C60.2188 792.625 59.3125 792.969 58.5938 793.656C57.875 794.333 57.5156 795.193 57.5156 796.234V796.312H53.1406V796.234ZM78.3594 812V793.781H78.2656L72.5156 797.75V793.5L78.3438 789.453H83.0312V812H78.3594ZM96.7656 812.5C94.349 812.5 92.349 811.854 90.7656 810.562C89.1927 809.26 88.3698 807.589 88.2969 805.547H92.6562C92.7917 806.505 93.2396 807.281 94 807.875C94.7708 808.469 95.7031 808.766 96.7969 808.766C98.026 808.766 99.026 808.38 99.7969 807.609C100.578 806.828 100.969 805.823 100.969 804.594C100.969 803.344 100.583 802.323 99.8125 801.531C99.0417 800.74 98.0469 800.344 96.8281 800.344C95.974 800.344 95.1979 800.531 94.5 800.906C93.8125 801.271 93.2708 801.776 92.875 802.422H88.6562L89.7656 789.453H104.109V793.203H93.4688L92.9531 799.375H93.0469C93.5156 798.604 94.1823 798 95.0469 797.562C95.9219 797.125 96.9271 796.906 98.0625 796.906C100.219 796.906 101.99 797.62 103.375 799.047C104.771 800.464 105.469 802.271 105.469 804.469C105.469 806.854 104.661 808.792 103.047 810.281C101.443 811.76 99.349 812.5 96.7656 812.5Z"
                            fill="white"
                          />
                        </g>
                        <g data-room="В-78__Г-216">
                          <rect
                            y="712"
                            width="128"
                            height="54"
                            rx="12"
                            fill="#2563EB"
                          />
                          <path
                            d="M27.9688 750H23.2344V727.453H37.7656V731.359H27.9688V750ZM49.5625 742.828H39.2969V738.844H49.5625V742.828ZM52.8438 734.234C52.8438 732.099 53.6146 730.354 55.1562 729C56.7083 727.635 58.7135 726.953 61.1719 726.953C63.5365 726.953 65.4635 727.568 66.9531 728.797C68.4427 730.016 69.1875 731.573 69.1875 733.469C69.1875 734.146 69.0833 734.802 68.875 735.438C68.6771 736.062 68.3542 736.693 67.9062 737.328C67.4688 737.953 67.026 738.521 66.5781 739.031C66.1302 739.531 65.5469 740.141 64.8281 740.859L59.3281 746.156V746.25H69.5V750H53.1094V746.828L61.6094 738.641C62.7552 737.495 63.5365 736.573 63.9531 735.875C64.3802 735.177 64.5938 734.438 64.5938 733.656C64.5938 732.802 64.2552 732.083 63.5781 731.5C62.901 730.917 62.0469 730.625 61.0156 730.625C59.9219 730.625 59.0156 730.969 58.2969 731.656C57.5781 732.333 57.2188 733.193 57.2188 734.234V734.312H52.8438V734.234ZM78.0625 750V731.781H77.9688L72.2188 735.75V731.5L78.0469 727.453H82.7344V750H78.0625ZM96.8906 750.516C95.2656 750.516 93.8073 750.161 92.5156 749.453C91.2344 748.734 90.1979 747.703 89.4062 746.359C88.1458 744.432 87.5156 741.948 87.5156 738.906C87.5156 735.188 88.3594 732.266 90.0469 730.141C91.7344 728.005 94.0417 726.938 96.9688 726.938C99.1146 726.938 100.953 727.516 102.484 728.672C104.016 729.828 104.938 731.328 105.25 733.172H100.609C100.38 732.422 99.9323 731.818 99.2656 731.359C98.599 730.901 97.8229 730.672 96.9375 730.672C95.3542 730.672 94.1198 731.391 93.2344 732.828C92.3594 734.266 91.9479 736.25 92 738.781H92.0938C92.5521 737.667 93.3125 736.776 94.375 736.109C95.4375 735.443 96.6771 735.109 98.0938 735.109C100.24 735.109 102.016 735.818 103.422 737.234C104.839 738.641 105.547 740.411 105.547 742.547C105.547 744.87 104.734 746.781 103.109 748.281C101.484 749.771 99.4115 750.516 96.8906 750.516ZM96.8438 746.75C97.9896 746.75 98.9583 746.359 99.75 745.578C100.552 744.786 100.953 743.823 100.953 742.688C100.953 741.521 100.562 740.557 99.7812 739.797C99.0104 739.036 98.0365 738.656 96.8594 738.656C95.6823 738.656 94.6979 739.036 93.9062 739.797C93.125 740.557 92.7344 741.505 92.7344 742.641C92.7344 743.786 93.1302 744.76 93.9219 745.562C94.7135 746.354 95.6875 746.75 96.8438 746.75Z"
                            fill="white"
                          />
                        </g>
                        <g data-room="В-78__Г-217">
                          <rect
                            y="650"
                            width="128"
                            height="54"
                            rx="12"
                            fill="#2563EB"
                          />
                          <path
                            d="M29.1094 688H24.375V665.453H38.9062V669.359H29.1094V688ZM50.7031 680.828H40.4375V676.844H50.7031V680.828ZM53.9844 672.234C53.9844 670.099 54.7552 668.354 56.2969 667C57.849 665.635 59.8542 664.953 62.3125 664.953C64.6771 664.953 66.6042 665.568 68.0938 666.797C69.5833 668.016 70.3281 669.573 70.3281 671.469C70.3281 672.146 70.224 672.802 70.0156 673.438C69.8177 674.062 69.4948 674.693 69.0469 675.328C68.6094 675.953 68.1667 676.521 67.7188 677.031C67.2708 677.531 66.6875 678.141 65.9688 678.859L60.4688 684.156V684.25H70.6406V688H54.25V684.828L62.75 676.641C63.8958 675.495 64.6771 674.573 65.0938 673.875C65.5208 673.177 65.7344 672.438 65.7344 671.656C65.7344 670.802 65.3958 670.083 64.7188 669.5C64.0417 668.917 63.1875 668.625 62.1562 668.625C61.0625 668.625 60.1562 668.969 59.4375 669.656C58.7188 670.333 58.3594 671.193 58.3594 672.234V672.312H53.9844V672.234ZM79.2031 688V669.781H79.1094L73.3594 673.75V669.5L79.1875 665.453H83.875V688H79.2031ZM90.1094 688L99.8125 669.297V669.203H88.3438V665.453H104.469V669.25L95.0625 688H90.1094Z"
                            fill="white"
                          />
                        </g>
                        <g data-room="В-78__Г-218">
                          <rect
                            y="588"
                            width="128"
                            height="54"
                            rx="12"
                            fill="#2563EB"
                          />
                          <path
                            d="M27.8281 626H23.0938V603.453H37.625V607.359H27.8281V626ZM49.4219 618.828H39.1562V614.844H49.4219V618.828ZM52.7031 610.234C52.7031 608.099 53.474 606.354 55.0156 605C56.5677 603.635 58.5729 602.953 61.0312 602.953C63.3958 602.953 65.3229 603.568 66.8125 604.797C68.3021 606.016 69.0469 607.573 69.0469 609.469C69.0469 610.146 68.9427 610.802 68.7344 611.438C68.5365 612.062 68.2135 612.693 67.7656 613.328C67.3281 613.953 66.8854 614.521 66.4375 615.031C65.9896 615.531 65.4062 616.141 64.6875 616.859L59.1875 622.156V622.25H69.3594V626H52.9688V622.828L61.4688 614.641C62.6146 613.495 63.3958 612.573 63.8125 611.875C64.2396 611.177 64.4531 610.438 64.4531 609.656C64.4531 608.802 64.1146 608.083 63.4375 607.5C62.7604 606.917 61.9062 606.625 60.875 606.625C59.7812 606.625 58.875 606.969 58.1562 607.656C57.4375 608.333 57.0781 609.193 57.0781 610.234V610.312H52.7031V610.234ZM77.9219 626V607.781H77.8281L72.0781 611.75V607.5L77.9062 603.453H82.5938V626H77.9219ZM96.5 626.5C93.7708 626.5 91.5625 625.891 89.875 624.672C88.1979 623.443 87.3594 621.849 87.3594 619.891C87.3594 618.411 87.849 617.146 88.8281 616.094C89.8073 615.031 91.0833 614.37 92.6562 614.109V614.016C91.3438 613.714 90.2812 613.099 89.4688 612.172C88.6667 611.234 88.2656 610.146 88.2656 608.906C88.2656 607.177 89.0365 605.755 90.5781 604.641C92.1198 603.516 94.0938 602.953 96.5 602.953C98.9167 602.953 100.891 603.516 102.422 604.641C103.953 605.755 104.719 607.182 104.719 608.922C104.719 610.141 104.318 611.219 103.516 612.156C102.714 613.083 101.656 613.703 100.344 614.016V614.109C101.927 614.38 103.203 615.047 104.172 616.109C105.151 617.161 105.641 618.427 105.641 619.906C105.641 621.865 104.792 623.453 103.094 624.672C101.406 625.891 99.2083 626.5 96.5 626.5ZM93.4531 622.078C94.2448 622.734 95.2604 623.062 96.5 623.062C97.7396 623.062 98.75 622.734 99.5312 622.078C100.312 621.411 100.703 620.568 100.703 619.547C100.703 618.526 100.312 617.688 99.5312 617.031C98.75 616.365 97.7396 616.031 96.5 616.031C95.2604 616.031 94.2448 616.365 93.4531 617.031C92.6719 617.688 92.2812 618.526 92.2812 619.547C92.2812 620.568 92.6719 621.411 93.4531 622.078ZM93.9375 611.719C94.6042 612.302 95.4583 612.594 96.5 612.594C97.5417 612.594 98.3958 612.302 99.0625 611.719C99.7292 611.125 100.062 610.38 100.062 609.484C100.062 608.578 99.7292 607.833 99.0625 607.25C98.3958 606.656 97.5417 606.359 96.5 606.359C95.4583 606.359 94.6042 606.656 93.9375 607.25C93.2708 607.833 92.9375 608.578 92.9375 609.484C92.9375 610.391 93.2708 611.135 93.9375 611.719Z"
                            fill="white"
                          />
                        </g>
                        <g data-room="В-78__Г-219">
                          <rect
                            y="526"
                            width="128"
                            height="54"
                            rx="12"
                            fill="#2563EB"
                          />
                          <path
                            d="M27.9844 564H23.25V541.453H37.7812V545.359H27.9844V564ZM49.5781 556.828H39.3125V552.844H49.5781V556.828ZM52.8594 548.234C52.8594 546.099 53.6302 544.354 55.1719 543C56.724 541.635 58.7292 540.953 61.1875 540.953C63.5521 540.953 65.4792 541.568 66.9688 542.797C68.4583 544.016 69.2031 545.573 69.2031 547.469C69.2031 548.146 69.099 548.802 68.8906 549.438C68.6927 550.062 68.3698 550.693 67.9219 551.328C67.4844 551.953 67.0417 552.521 66.5938 553.031C66.1458 553.531 65.5625 554.141 64.8438 554.859L59.3438 560.156V560.25H69.5156V564H53.125V560.828L61.625 552.641C62.7708 551.495 63.5521 550.573 63.9688 549.875C64.3958 549.177 64.6094 548.438 64.6094 547.656C64.6094 546.802 64.2708 546.083 63.5938 545.5C62.9167 544.917 62.0625 544.625 61.0312 544.625C59.9375 544.625 59.0312 544.969 58.3125 545.656C57.5938 546.333 57.2344 547.193 57.2344 548.234V548.312H52.8594V548.234ZM78.0781 564V545.781H77.9844L72.2344 549.75V545.5L78.0625 541.453H82.75V564H78.0781ZM95.9844 564.5C93.8281 564.5 91.9792 563.922 90.4375 562.766C88.8958 561.599 87.9688 560.094 87.6562 558.25H92.3125C92.5417 559.01 92.9948 559.62 93.6719 560.078C94.3594 560.536 95.1562 560.766 96.0625 560.766C97.6354 560.766 98.8542 560.052 99.7188 558.625C100.594 557.198 101 555.203 100.938 552.641H100.891H100.859H100.844C100.427 553.766 99.6875 554.661 98.625 555.328C97.5625 555.995 96.3021 556.328 94.8438 556.328C92.7083 556.328 90.9271 555.625 89.5 554.219C88.0729 552.802 87.3594 551.026 87.3594 548.891C87.3594 546.578 88.1771 544.677 89.8125 543.188C91.4479 541.688 93.526 540.938 96.0469 540.938C97.6823 540.938 99.1458 541.292 100.438 542C101.74 542.708 102.781 543.729 103.562 545.062C104.823 547 105.453 549.49 105.453 552.531C105.453 556.271 104.615 559.203 102.938 561.328C101.271 563.443 98.9531 564.5 95.9844 564.5ZM93.1406 551.641C93.9219 552.401 94.901 552.781 96.0781 552.781C97.2552 552.781 98.2344 552.401 99.0156 551.641C99.8073 550.87 100.203 549.917 100.203 548.781C100.203 547.635 99.8073 546.672 99.0156 545.891C98.224 545.099 97.2552 544.703 96.1094 544.703C94.9531 544.703 93.974 545.094 93.1719 545.875C92.3698 546.656 91.9688 547.615 91.9688 548.75C91.9688 549.906 92.3594 550.87 93.1406 551.641Z"
                            fill="white"
                          />
                        </g>
                        <g data-room="В-78__Г-220">
                          <rect
                            y="464"
                            width="128"
                            height="54"
                            rx="12"
                            fill="#2563EB"
                          />
                          <path
                            d="M25.9219 502H21.1875V479.453H35.7188V483.359H25.9219V502ZM47.5156 494.828H37.25V490.844H47.5156V494.828ZM50.7969 486.234C50.7969 484.099 51.5677 482.354 53.1094 481C54.6615 479.635 56.6667 478.953 59.125 478.953C61.4896 478.953 63.4167 479.568 64.9062 480.797C66.3958 482.016 67.1406 483.573 67.1406 485.469C67.1406 486.146 67.0365 486.802 66.8281 487.438C66.6302 488.062 66.3073 488.693 65.8594 489.328C65.4219 489.953 64.9792 490.521 64.5312 491.031C64.0833 491.531 63.5 492.141 62.7812 492.859L57.2812 498.156V498.25H67.4531V502H51.0625V498.828L59.5625 490.641C60.7083 489.495 61.4896 488.573 61.9062 487.875C62.3333 487.177 62.5469 486.438 62.5469 485.656C62.5469 484.802 62.2083 484.083 61.5312 483.5C60.8542 482.917 60 482.625 58.9688 482.625C57.875 482.625 56.9688 482.969 56.25 483.656C55.5312 484.333 55.1719 485.193 55.1719 486.234V486.312H50.7969V486.234ZM70.1094 486.234C70.1094 484.099 70.8802 482.354 72.4219 481C73.974 479.635 75.9792 478.953 78.4375 478.953C80.8021 478.953 82.7292 479.568 84.2188 480.797C85.7083 482.016 86.4531 483.573 86.4531 485.469C86.4531 486.146 86.349 486.802 86.1406 487.438C85.9427 488.062 85.6198 488.693 85.1719 489.328C84.7344 489.953 84.2917 490.521 83.8438 491.031C83.3958 491.531 82.8125 492.141 82.0938 492.859L76.5938 498.156V498.25H86.7656V502H70.375V498.828L78.875 490.641C80.0208 489.495 80.8021 488.573 81.2188 487.875C81.6458 487.177 81.8594 486.438 81.8594 485.656C81.8594 484.802 81.5208 484.083 80.8438 483.5C80.1667 482.917 79.3125 482.625 78.2812 482.625C77.1875 482.625 76.2812 482.969 75.5625 483.656C74.8438 484.333 74.4844 485.193 74.4844 486.234V486.312H70.1094V486.234ZM105.094 499.328C103.479 501.443 101.255 502.5 98.4219 502.5C95.5885 502.5 93.3594 501.448 91.7344 499.344C90.1094 497.229 89.2969 494.344 89.2969 490.688C89.2969 487.052 90.1094 484.188 91.7344 482.094C93.3698 479.99 95.599 478.938 98.4219 478.938C101.245 478.938 103.469 479.984 105.094 482.078C106.719 484.172 107.531 487.036 107.531 490.672C107.531 494.318 106.719 497.203 105.094 499.328ZM95.2344 496.609C96.0052 498.016 97.0677 498.719 98.4219 498.719C99.776 498.719 100.833 498.021 101.594 496.625C102.354 495.219 102.734 493.24 102.734 490.688C102.734 488.156 102.349 486.198 101.578 484.812C100.818 483.417 99.7656 482.719 98.4219 482.719C97.0781 482.719 96.0208 483.417 95.25 484.812C94.4792 486.208 94.0938 488.167 94.0938 490.688C94.0938 493.229 94.474 495.203 95.2344 496.609Z"
                            fill="white"
                          />
                        </g>
                        <g data-room="В-78__Г-221">
                          <rect
                            y="402"
                            width="128"
                            height="54"
                            rx="12"
                            fill="#2563EB"
                          />
                          <path
                            d="M28.6094 440H23.875V417.453H38.4062V421.359H28.6094V440ZM50.2031 432.828H39.9375V428.844H50.2031V432.828ZM53.4844 424.234C53.4844 422.099 54.2552 420.354 55.7969 419C57.349 417.635 59.3542 416.953 61.8125 416.953C64.1771 416.953 66.1042 417.568 67.5938 418.797C69.0833 420.016 69.8281 421.573 69.8281 423.469C69.8281 424.146 69.724 424.802 69.5156 425.438C69.3177 426.062 68.9948 426.693 68.5469 427.328C68.1094 427.953 67.6667 428.521 67.2188 429.031C66.7708 429.531 66.1875 430.141 65.4688 430.859L59.9688 436.156V436.25H70.1406V440H53.75V436.828L62.25 428.641C63.3958 427.495 64.1771 426.573 64.5938 425.875C65.0208 425.177 65.2344 424.438 65.2344 423.656C65.2344 422.802 64.8958 422.083 64.2188 421.5C63.5417 420.917 62.6875 420.625 61.6562 420.625C60.5625 420.625 59.6562 420.969 58.9375 421.656C58.2188 422.333 57.8594 423.193 57.8594 424.234V424.312H53.4844V424.234ZM72.7969 424.234C72.7969 422.099 73.5677 420.354 75.1094 419C76.6615 417.635 78.6667 416.953 81.125 416.953C83.4896 416.953 85.4167 417.568 86.9062 418.797C88.3958 420.016 89.1406 421.573 89.1406 423.469C89.1406 424.146 89.0365 424.802 88.8281 425.438C88.6302 426.062 88.3073 426.693 87.8594 427.328C87.4219 427.953 86.9792 428.521 86.5312 429.031C86.0833 429.531 85.5 430.141 84.7812 430.859L79.2812 436.156V436.25H89.4531V440H73.0625V436.828L81.5625 428.641C82.7083 427.495 83.4896 426.573 83.9062 425.875C84.3333 425.177 84.5469 424.438 84.5469 423.656C84.5469 422.802 84.2083 422.083 83.5312 421.5C82.8542 420.917 82 420.625 80.9688 420.625C79.875 420.625 78.9688 420.969 78.25 421.656C77.5312 422.333 77.1719 423.193 77.1719 424.234V424.312H72.7969V424.234ZM98.0156 440V421.781H97.9219L92.1719 425.75V421.5L98 417.453H102.688V440H98.0156Z"
                            fill="white"
                          />
                        </g>
                        <g data-room="В-78__Г-222">
                          <rect
                            y="340"
                            width="128"
                            height="54"
                            rx="12"
                            fill="#2563EB"
                          />
                          <path
                            d="M26.6406 378H21.9062V355.453H36.4375V359.359H26.6406V378ZM48.2344 370.828H37.9688V366.844H48.2344V370.828ZM51.5156 362.234C51.5156 360.099 52.2865 358.354 53.8281 357C55.3802 355.635 57.3854 354.953 59.8438 354.953C62.2083 354.953 64.1354 355.568 65.625 356.797C67.1146 358.016 67.8594 359.573 67.8594 361.469C67.8594 362.146 67.7552 362.802 67.5469 363.438C67.349 364.062 67.026 364.693 66.5781 365.328C66.1406 365.953 65.6979 366.521 65.25 367.031C64.8021 367.531 64.2188 368.141 63.5 368.859L58 374.156V374.25H68.1719V378H51.7812V374.828L60.2812 366.641C61.4271 365.495 62.2083 364.573 62.625 363.875C63.0521 363.177 63.2656 362.438 63.2656 361.656C63.2656 360.802 62.9271 360.083 62.25 359.5C61.5729 358.917 60.7188 358.625 59.6875 358.625C58.5938 358.625 57.6875 358.969 56.9688 359.656C56.25 360.333 55.8906 361.193 55.8906 362.234V362.312H51.5156V362.234ZM70.8281 362.234C70.8281 360.099 71.599 358.354 73.1406 357C74.6927 355.635 76.6979 354.953 79.1562 354.953C81.5208 354.953 83.4479 355.568 84.9375 356.797C86.4271 358.016 87.1719 359.573 87.1719 361.469C87.1719 362.146 87.0677 362.802 86.8594 363.438C86.6615 364.062 86.3385 364.693 85.8906 365.328C85.4531 365.953 85.0104 366.521 84.5625 367.031C84.1146 367.531 83.5312 368.141 82.8125 368.859L77.3125 374.156V374.25H87.4844V378H71.0938V374.828L79.5938 366.641C80.7396 365.495 81.5208 364.573 81.9375 363.875C82.3646 363.177 82.5781 362.438 82.5781 361.656C82.5781 360.802 82.2396 360.083 81.5625 359.5C80.8854 358.917 80.0312 358.625 79 358.625C77.9062 358.625 77 358.969 76.2812 359.656C75.5625 360.333 75.2031 361.193 75.2031 362.234V362.312H70.8281V362.234ZM90.1406 362.234C90.1406 360.099 90.9115 358.354 92.4531 357C94.0052 355.635 96.0104 354.953 98.4688 354.953C100.833 354.953 102.76 355.568 104.25 356.797C105.74 358.016 106.484 359.573 106.484 361.469C106.484 362.146 106.38 362.802 106.172 363.438C105.974 364.062 105.651 364.693 105.203 365.328C104.766 365.953 104.323 366.521 103.875 367.031C103.427 367.531 102.844 368.141 102.125 368.859L96.625 374.156V374.25H106.797V378H90.4062V374.828L98.9062 366.641C100.052 365.495 100.833 364.573 101.25 363.875C101.677 363.177 101.891 362.438 101.891 361.656C101.891 360.802 101.552 360.083 100.875 359.5C100.198 358.917 99.3438 358.625 98.3125 358.625C97.2188 358.625 96.3125 358.969 95.5938 359.656C94.875 360.333 94.5156 361.193 94.5156 362.234V362.312H90.1406V362.234Z"
                            fill="white"
                          />
                        </g>
                        <g data-room="В-78__Г-223">
                          <rect
                            y="208"
                            width="128"
                            height="66"
                            rx="12"
                            fill="#2563EB"
                          />
                          <path
                            d="M26.2188 252H21.4844V229.453H36.0156V233.359H26.2188V252ZM47.8125 244.828H37.5469V240.844H47.8125V244.828ZM51.0938 236.234C51.0938 234.099 51.8646 232.354 53.4062 231C54.9583 229.635 56.9635 228.953 59.4219 228.953C61.7865 228.953 63.7135 229.568 65.2031 230.797C66.6927 232.016 67.4375 233.573 67.4375 235.469C67.4375 236.146 67.3333 236.802 67.125 237.438C66.9271 238.062 66.6042 238.693 66.1562 239.328C65.7188 239.953 65.276 240.521 64.8281 241.031C64.3802 241.531 63.7969 242.141 63.0781 242.859L57.5781 248.156V248.25H67.75V252H51.3594V248.828L59.8594 240.641C61.0052 239.495 61.7865 238.573 62.2031 237.875C62.6302 237.177 62.8438 236.438 62.8438 235.656C62.8438 234.802 62.5052 234.083 61.8281 233.5C61.151 232.917 60.2969 232.625 59.2656 232.625C58.1719 232.625 57.2656 232.969 56.5469 233.656C55.8281 234.333 55.4688 235.193 55.4688 236.234V236.312H51.0938V236.234ZM70.4062 236.234C70.4062 234.099 71.1771 232.354 72.7188 231C74.2708 229.635 76.276 228.953 78.7344 228.953C81.099 228.953 83.026 229.568 84.5156 230.797C86.0052 232.016 86.75 233.573 86.75 235.469C86.75 236.146 86.6458 236.802 86.4375 237.438C86.2396 238.062 85.9167 238.693 85.4688 239.328C85.0312 239.953 84.5885 240.521 84.1406 241.031C83.6927 241.531 83.1094 242.141 82.3906 242.859L76.8906 248.156V248.25H87.0625V252H70.6719V248.828L79.1719 240.641C80.3177 239.495 81.099 238.573 81.5156 237.875C81.9427 237.177 82.1562 236.438 82.1562 235.656C82.1562 234.802 81.8177 234.083 81.1406 233.5C80.4635 232.917 79.6094 232.625 78.5781 232.625C77.4844 232.625 76.5781 232.969 75.8594 233.656C75.1406 234.333 74.7812 235.193 74.7812 236.234V236.312H70.4062V236.234ZM95.4688 242.156V238.75H98.2031C99.276 238.75 100.146 238.458 100.812 237.875C101.479 237.292 101.812 236.536 101.812 235.609C101.812 234.682 101.495 233.948 100.859 233.406C100.224 232.854 99.3281 232.578 98.1719 232.578C97.0781 232.578 96.1927 232.875 95.5156 233.469C94.8385 234.062 94.4688 234.854 94.4062 235.844H90.0625C90.1458 233.75 90.9427 232.078 92.4531 230.828C93.9635 229.578 95.9375 228.953 98.375 228.953C100.729 228.953 102.63 229.505 104.078 230.609C105.536 231.714 106.266 233.167 106.266 234.969C106.266 236.333 105.839 237.49 104.984 238.438C104.13 239.385 103.005 239.984 101.609 240.234V240.328C103.307 240.474 104.651 241.031 105.641 242C106.641 242.958 107.141 244.214 107.141 245.766C107.141 247.776 106.312 249.401 104.656 250.641C103.01 251.88 100.88 252.5 98.2656 252.5C95.7344 252.5 93.6875 251.865 92.125 250.594C90.5729 249.323 89.7396 247.641 89.625 245.547H94.1406C94.2135 246.505 94.6198 247.271 95.3594 247.844C96.1094 248.417 97.099 248.703 98.3281 248.703C99.5052 248.703 100.469 248.401 101.219 247.797C101.969 247.193 102.344 246.417 102.344 245.469C102.344 244.438 101.979 243.63 101.25 243.047C100.521 242.453 99.5208 242.156 98.25 242.156H95.4688Z"
                            fill="white"
                          />
                        </g>
                        <g data-room="В-78__Г-225">
                          <rect
                            y="2"
                            width="200"
                            height="56"
                            rx="12"
                            fill="#2563EB"
                          />
                          <path
                            d="M62.2969 41H57.5625V18.4531H72.0938V22.3594H62.2969V41ZM83.8906 33.8281H73.625V29.8438H83.8906V33.8281ZM87.1719 25.2344C87.1719 23.099 87.9427 21.3542 89.4844 20C91.0365 18.6354 93.0417 17.9531 95.5 17.9531C97.8646 17.9531 99.7917 18.5677 101.281 19.7969C102.771 21.0156 103.516 22.5729 103.516 24.4688C103.516 25.1458 103.411 25.8021 103.203 26.4375C103.005 27.0625 102.682 27.6927 102.234 28.3281C101.797 28.9531 101.354 29.5208 100.906 30.0312C100.458 30.5312 99.875 31.1406 99.1562 31.8594L93.6562 37.1562V37.25H103.828V41H87.4375V37.8281L95.9375 29.6406C97.0833 28.4948 97.8646 27.5729 98.2812 26.875C98.7083 26.1771 98.9219 25.4375 98.9219 24.6562C98.9219 23.8021 98.5833 23.0833 97.9062 22.5C97.2292 21.9167 96.375 21.625 95.3438 21.625C94.25 21.625 93.3438 21.9688 92.625 22.6562C91.9062 23.3333 91.5469 24.1927 91.5469 25.2344V25.3125H87.1719V25.2344ZM106.484 25.2344C106.484 23.099 107.255 21.3542 108.797 20C110.349 18.6354 112.354 17.9531 114.812 17.9531C117.177 17.9531 119.104 18.5677 120.594 19.7969C122.083 21.0156 122.828 22.5729 122.828 24.4688C122.828 25.1458 122.724 25.8021 122.516 26.4375C122.318 27.0625 121.995 27.6927 121.547 28.3281C121.109 28.9531 120.667 29.5208 120.219 30.0312C119.771 30.5312 119.188 31.1406 118.469 31.8594L112.969 37.1562V37.25H123.141V41H106.75V37.8281L115.25 29.6406C116.396 28.4948 117.177 27.5729 117.594 26.875C118.021 26.1771 118.234 25.4375 118.234 24.6562C118.234 23.8021 117.896 23.0833 117.219 22.5C116.542 21.9167 115.688 21.625 114.656 21.625C113.562 21.625 112.656 21.9688 111.938 22.6562C111.219 23.3333 110.859 24.1927 110.859 25.2344V25.3125H106.484V25.2344ZM134.734 41.5C132.318 41.5 130.318 40.8542 128.734 39.5625C127.161 38.2604 126.339 36.5885 126.266 34.5469H130.625C130.76 35.5052 131.208 36.2812 131.969 36.875C132.74 37.4688 133.672 37.7656 134.766 37.7656C135.995 37.7656 136.995 37.3802 137.766 36.6094C138.547 35.8281 138.938 34.8229 138.938 33.5938C138.938 32.3438 138.552 31.3229 137.781 30.5312C137.01 29.7396 136.016 29.3438 134.797 29.3438C133.943 29.3438 133.167 29.5312 132.469 29.9062C131.781 30.2708 131.24 30.776 130.844 31.4219H126.625L127.734 18.4531H142.078V22.2031H131.438L130.922 28.375H131.016C131.484 27.6042 132.151 27 133.016 26.5625C133.891 26.125 134.896 25.9062 136.031 25.9062C138.188 25.9062 139.958 26.6198 141.344 28.0469C142.74 29.4635 143.438 31.2708 143.438 33.4688C143.438 35.8542 142.63 37.7917 141.016 39.2812C139.411 40.7604 137.318 41.5 134.734 41.5Z"
                            fill="white"
                          />
                        </g>
                        <g data-room="В-78__Г-211">
                          <rect
                            x="504"
                            y="898"
                            width="124"
                            height="60"
                            rx="12"
                            fill="#2563EB"
                          />
                          <path
                            d="M532.578 939H527.844V916.453H542.375V920.359H532.578V939ZM554.172 931.828H543.906V927.844H554.172V931.828ZM557.453 923.234C557.453 921.099 558.224 919.354 559.766 918C561.318 916.635 563.323 915.953 565.781 915.953C568.146 915.953 570.073 916.568 571.562 917.797C573.052 919.016 573.797 920.573 573.797 922.469C573.797 923.146 573.693 923.802 573.484 924.438C573.286 925.062 572.964 925.693 572.516 926.328C572.078 926.953 571.635 927.521 571.188 928.031C570.74 928.531 570.156 929.141 569.438 929.859L563.938 935.156V935.25H574.109V939H557.719V935.828L566.219 927.641C567.365 926.495 568.146 925.573 568.562 924.875C568.99 924.177 569.203 923.438 569.203 922.656C569.203 921.802 568.865 921.083 568.188 920.5C567.51 919.917 566.656 919.625 565.625 919.625C564.531 919.625 563.625 919.969 562.906 920.656C562.188 921.333 561.828 922.193 561.828 923.234V923.312H557.453V923.234ZM582.672 939V920.781H582.578L576.828 924.75V920.5L582.656 916.453H587.344V939H582.672ZM598.047 939V920.781H597.953L592.203 924.75V920.5L598.031 916.453H602.719V939H598.047Z"
                            fill="white"
                          />
                        </g>
                        <g data-room="В-78__B-320">
                          <rect
                            x="756"
                            y="898"
                            width="60"
                            height="128"
                            rx="12"
                            fill="#2563EB"
                          />
                          <path
                            d="M797 997.562V1007.55H774.453V997.734C774.453 995.62 774.958 993.943 775.969 992.703C776.979 991.464 778.349 990.844 780.078 990.844C781.307 990.844 782.385 991.25 783.312 992.062C784.24 992.865 784.792 993.87 784.969 995.078H785.094C785.208 993.536 785.776 992.266 786.797 991.266C787.818 990.266 789.068 989.766 790.547 989.766C792.536 989.766 794.109 990.464 795.266 991.859C796.422 993.255 797 995.156 797 997.562ZM777.969 1002.83H783.828V999.438C783.828 998.177 783.568 997.203 783.047 996.516C782.516 995.828 781.771 995.484 780.812 995.484C779.906 995.484 779.208 995.786 778.719 996.391C778.219 996.995 777.969 997.849 777.969 998.953V1002.83ZM793.484 1002.83V998.766C793.484 997.401 793.203 996.365 792.641 995.656C792.068 994.938 791.245 994.578 790.172 994.578C789.12 994.578 788.318 994.948 787.766 995.688C787.214 996.417 786.938 997.479 786.938 998.875V1002.83H793.484ZM789.828 976.75V987.016H785.844V976.75H789.828ZM787.156 967.719H783.75V964.984C783.75 963.911 783.458 963.042 782.875 962.375C782.292 961.708 781.536 961.375 780.609 961.375C779.682 961.375 778.948 961.693 778.406 962.328C777.854 962.964 777.578 963.859 777.578 965.016C777.578 966.109 777.875 966.995 778.469 967.672C779.062 968.349 779.854 968.719 780.844 968.781V973.125C778.75 973.042 777.078 972.245 775.828 970.734C774.578 969.224 773.953 967.25 773.953 964.812C773.953 962.458 774.505 960.557 775.609 959.109C776.714 957.651 778.167 956.922 779.969 956.922C781.333 956.922 782.49 957.349 783.438 958.203C784.385 959.057 784.984 960.182 785.234 961.578H785.328C785.474 959.88 786.031 958.536 787 957.547C787.958 956.547 789.214 956.047 790.766 956.047C792.776 956.047 794.401 956.875 795.641 958.531C796.88 960.177 797.5 962.307 797.5 964.922C797.5 967.453 796.865 969.5 795.594 971.062C794.323 972.615 792.641 973.448 790.547 973.562V969.047C791.505 968.974 792.271 968.568 792.844 967.828C793.417 967.078 793.703 966.089 793.703 964.859C793.703 963.682 793.401 962.719 792.797 961.969C792.193 961.219 791.417 960.844 790.469 960.844C789.438 960.844 788.63 961.208 788.047 961.938C787.453 962.667 787.156 963.667 787.156 964.938V967.719ZM781.234 953.312C779.099 953.312 777.354 952.542 776 951C774.635 949.448 773.953 947.443 773.953 944.984C773.953 942.62 774.568 940.693 775.797 939.203C777.016 937.714 778.573 936.969 780.469 936.969C781.146 936.969 781.802 937.073 782.438 937.281C783.062 937.479 783.693 937.802 784.328 938.25C784.953 938.688 785.521 939.13 786.031 939.578C786.531 940.026 787.141 940.609 787.859 941.328L793.156 946.828H793.25V936.656H797V953.047H793.828L785.641 944.547C784.495 943.401 783.573 942.62 782.875 942.203C782.177 941.776 781.438 941.562 780.656 941.562C779.802 941.562 779.083 941.901 778.5 942.578C777.917 943.255 777.625 944.109 777.625 945.141C777.625 946.234 777.969 947.141 778.656 947.859C779.333 948.578 780.193 948.938 781.234 948.938H781.312V953.312H781.234ZM794.328 918.328C796.443 919.943 797.5 922.167 797.5 925C797.5 927.833 796.448 930.062 794.344 931.688C792.229 933.312 789.344 934.125 785.688 934.125C782.052 934.125 779.188 933.312 777.094 931.688C774.99 930.052 773.938 927.823 773.938 925C773.938 922.177 774.984 919.953 777.078 918.328C779.172 916.703 782.036 915.891 785.672 915.891C789.318 915.891 792.203 916.703 794.328 918.328ZM791.609 928.188C793.016 927.417 793.719 926.354 793.719 925C793.719 923.646 793.021 922.589 791.625 921.828C790.219 921.068 788.24 920.688 785.688 920.688C783.156 920.688 781.198 921.073 779.812 921.844C778.417 922.604 777.719 923.656 777.719 925C777.719 926.344 778.417 927.401 779.812 928.172C781.208 928.943 783.167 929.328 785.688 929.328C788.229 929.328 790.203 928.948 791.609 928.188Z"
                            fill="white"
                          />
                        </g>
                        <g data-room="В-78__Г-209">
                          <rect
                            x="824"
                            y="898"
                            width="60"
                            height="128"
                            rx="12"
                            fill="#2563EB"
                          />
                          <path
                            d="M865 1000.75V1005.48H842.453V990.953H846.359V1000.75H865ZM857.828 979.156V989.422H853.844V979.156H857.828ZM849.234 975.875C847.099 975.875 845.354 975.104 844 973.562C842.635 972.01 841.953 970.005 841.953 967.547C841.953 965.182 842.568 963.255 843.797 961.766C845.016 960.276 846.573 959.531 848.469 959.531C849.146 959.531 849.802 959.635 850.438 959.844C851.062 960.042 851.693 960.365 852.328 960.812C852.953 961.25 853.521 961.693 854.031 962.141C854.531 962.589 855.141 963.172 855.859 963.891L861.156 969.391H861.25V959.219H865V975.609H861.828L853.641 967.109C852.495 965.964 851.573 965.182 850.875 964.766C850.177 964.339 849.438 964.125 848.656 964.125C847.802 964.125 847.083 964.464 846.5 965.141C845.917 965.818 845.625 966.672 845.625 967.703C845.625 968.797 845.969 969.703 846.656 970.422C847.333 971.141 848.193 971.5 849.234 971.5H849.312V975.875H849.234ZM862.328 940.891C864.443 942.505 865.5 944.729 865.5 947.562C865.5 950.396 864.448 952.625 862.344 954.25C860.229 955.875 857.344 956.688 853.688 956.688C850.052 956.688 847.188 955.875 845.094 954.25C842.99 952.615 841.938 950.385 841.938 947.562C841.938 944.74 842.984 942.516 845.078 940.891C847.172 939.266 850.036 938.453 853.672 938.453C857.318 938.453 860.203 939.266 862.328 940.891ZM859.609 950.75C861.016 949.979 861.719 948.917 861.719 947.562C861.719 946.208 861.021 945.151 859.625 944.391C858.219 943.63 856.24 943.25 853.688 943.25C851.156 943.25 849.198 943.635 847.812 944.406C846.417 945.167 845.719 946.219 845.719 947.562C845.719 948.906 846.417 949.964 847.812 950.734C849.208 951.505 851.167 951.891 853.688 951.891C856.229 951.891 858.203 951.51 859.609 950.75ZM865.5 927.281C865.5 929.438 864.922 931.286 863.766 932.828C862.599 934.37 861.094 935.297 859.25 935.609V930.953C860.01 930.724 860.62 930.271 861.078 929.594C861.536 928.906 861.766 928.109 861.766 927.203C861.766 925.63 861.052 924.411 859.625 923.547C858.198 922.672 856.203 922.266 853.641 922.328V922.375V922.406V922.422C854.766 922.839 855.661 923.578 856.328 924.641C856.995 925.703 857.328 926.964 857.328 928.422C857.328 930.557 856.625 932.339 855.219 933.766C853.802 935.193 852.026 935.906 849.891 935.906C847.578 935.906 845.677 935.089 844.188 933.453C842.688 931.818 841.938 929.74 841.938 927.219C841.938 925.583 842.292 924.12 843 922.828C843.708 921.526 844.729 920.484 846.062 919.703C848 918.443 850.49 917.812 853.531 917.812C857.271 917.812 860.203 918.651 862.328 920.328C864.443 921.995 865.5 924.312 865.5 927.281ZM852.641 930.125C853.401 929.344 853.781 928.365 853.781 927.188C853.781 926.01 853.401 925.031 852.641 924.25C851.87 923.458 850.917 923.062 849.781 923.062C848.635 923.062 847.672 923.458 846.891 924.25C846.099 925.042 845.703 926.01 845.703 927.156C845.703 928.312 846.094 929.292 846.875 930.094C847.656 930.896 848.615 931.297 849.75 931.297C850.906 931.297 851.87 930.906 852.641 930.125Z"
                            fill="white"
                          />
                        </g>
                        <g data-room="В-78__Г-208-1">
                          <rect
                            x="892"
                            y="898"
                            width="60"
                            height="128"
                            rx="12"
                            fill="#2563EB"
                          />
                          <path
                            d="M933 1015.27V1020H910.453V1005.47H914.359V1015.27H933ZM925.828 993.672V1003.94H921.844V993.672H925.828ZM917.234 990.391C915.099 990.391 913.354 989.62 912 988.078C910.635 986.526 909.953 984.521 909.953 982.062C909.953 979.698 910.568 977.771 911.797 976.281C913.016 974.792 914.573 974.047 916.469 974.047C917.146 974.047 917.802 974.151 918.438 974.359C919.062 974.557 919.693 974.88 920.328 975.328C920.953 975.766 921.521 976.208 922.031 976.656C922.531 977.104 923.141 977.688 923.859 978.406L929.156 983.906H929.25V973.734H933V990.125H929.828L921.641 981.625C920.495 980.479 919.573 979.698 918.875 979.281C918.177 978.854 917.438 978.641 916.656 978.641C915.802 978.641 915.083 978.979 914.5 979.656C913.917 980.333 913.625 981.188 913.625 982.219C913.625 983.312 913.969 984.219 914.656 984.938C915.333 985.656 916.193 986.016 917.234 986.016H917.312V990.391H917.234ZM930.328 955.406C932.443 957.021 933.5 959.245 933.5 962.078C933.5 964.911 932.448 967.141 930.344 968.766C928.229 970.391 925.344 971.203 921.688 971.203C918.052 971.203 915.188 970.391 913.094 968.766C910.99 967.13 909.938 964.901 909.938 962.078C909.938 959.255 910.984 957.031 913.078 955.406C915.172 953.781 918.036 952.969 921.672 952.969C925.318 952.969 928.203 953.781 930.328 955.406ZM927.609 965.266C929.016 964.495 929.719 963.432 929.719 962.078C929.719 960.724 929.021 959.667 927.625 958.906C926.219 958.146 924.24 957.766 921.688 957.766C919.156 957.766 917.198 958.151 915.812 958.922C914.417 959.682 913.719 960.734 913.719 962.078C913.719 963.422 914.417 964.479 915.812 965.25C917.208 966.021 919.167 966.406 921.688 966.406C924.229 966.406 926.203 966.026 927.609 965.266ZM933.5 941.219C933.5 943.948 932.891 946.156 931.672 947.844C930.443 949.521 928.849 950.359 926.891 950.359C925.411 950.359 924.146 949.87 923.094 948.891C922.031 947.911 921.37 946.635 921.109 945.062H921.016C920.714 946.375 920.099 947.438 919.172 948.25C918.234 949.052 917.146 949.453 915.906 949.453C914.177 949.453 912.755 948.682 911.641 947.141C910.516 945.599 909.953 943.625 909.953 941.219C909.953 938.802 910.516 936.828 911.641 935.297C912.755 933.766 914.182 933 915.922 933C917.141 933 918.219 933.401 919.156 934.203C920.083 935.005 920.703 936.062 921.016 937.375H921.109C921.38 935.792 922.047 934.516 923.109 933.547C924.161 932.568 925.427 932.078 926.906 932.078C928.865 932.078 930.453 932.927 931.672 934.625C932.891 936.312 933.5 938.51 933.5 941.219ZM929.078 944.266C929.734 943.474 930.062 942.458 930.062 941.219C930.062 939.979 929.734 938.969 929.078 938.188C928.411 937.406 927.568 937.016 926.547 937.016C925.526 937.016 924.688 937.406 924.031 938.188C923.365 938.969 923.031 939.979 923.031 941.219C923.031 942.458 923.365 943.474 924.031 944.266C924.688 945.047 925.526 945.438 926.547 945.438C927.568 945.438 928.411 945.047 929.078 944.266ZM918.719 943.781C919.302 943.115 919.594 942.26 919.594 941.219C919.594 940.177 919.302 939.323 918.719 938.656C918.125 937.99 917.38 937.656 916.484 937.656C915.578 937.656 914.833 937.99 914.25 938.656C913.656 939.323 913.359 940.177 913.359 941.219C913.359 942.26 913.656 943.115 914.25 943.781C914.833 944.448 915.578 944.781 916.484 944.781C917.391 944.781 918.135 944.448 918.719 943.781ZM925.828 918.578V928.844H921.844V918.578H925.828ZM933 910.109H914.781V910.203L918.75 915.953H914.5L910.453 910.125V905.438H933V910.109Z"
                            fill="white"
                          />
                        </g>
                        <g data-room="В-78__Г-211-1">
                          <rect
                            x="504"
                            y="966"
                            width="124"
                            height="60"
                            rx="12"
                            fill="#2563EB"
                          />
                          <path
                            d="M518.172 1007H513.438V984.453H527.969V988.359H518.172V1007ZM539.766 999.828H529.5V995.844H539.766V999.828ZM543.047 991.234C543.047 989.099 543.818 987.354 545.359 986C546.911 984.635 548.917 983.953 551.375 983.953C553.74 983.953 555.667 984.568 557.156 985.797C558.646 987.016 559.391 988.573 559.391 990.469C559.391 991.146 559.286 991.802 559.078 992.438C558.88 993.062 558.557 993.693 558.109 994.328C557.672 994.953 557.229 995.521 556.781 996.031C556.333 996.531 555.75 997.141 555.031 997.859L549.531 1003.16V1003.25H559.703V1007H543.312V1003.83L551.812 995.641C552.958 994.495 553.74 993.573 554.156 992.875C554.583 992.177 554.797 991.438 554.797 990.656C554.797 989.802 554.458 989.083 553.781 988.5C553.104 987.917 552.25 987.625 551.219 987.625C550.125 987.625 549.219 987.969 548.5 988.656C547.781 989.333 547.422 990.193 547.422 991.234V991.312H543.047V991.234ZM568.266 1007V988.781H568.172L562.422 992.75V988.5L568.25 984.453H572.938V1007H568.266ZM583.641 1007V988.781H583.547L577.797 992.75V988.5L583.625 984.453H588.312V1007H583.641ZM603.984 999.828H593.719V995.844H603.984V999.828ZM612.453 1007V988.781H612.359L606.609 992.75V988.5L612.438 984.453H617.125V1007H612.453Z"
                            fill="white"
                          />
                        </g>
                        <g data-room="В-78__Г-210-1">
                          <rect
                            x="636"
                            y="898"
                            width="112"
                            height="128"
                            rx="12"
                            fill="#2563EB"
                          />
                          <path
                            d="M641.438 973H636.703V950.453H651.234V954.359H641.438V973ZM663.031 965.828H652.766V961.844H663.031V965.828ZM666.312 957.234C666.312 955.099 667.083 953.354 668.625 952C670.177 950.635 672.182 949.953 674.641 949.953C677.005 949.953 678.932 950.568 680.422 951.797C681.911 953.016 682.656 954.573 682.656 956.469C682.656 957.146 682.552 957.802 682.344 958.438C682.146 959.062 681.823 959.693 681.375 960.328C680.938 960.953 680.495 961.521 680.047 962.031C679.599 962.531 679.016 963.141 678.297 963.859L672.797 969.156V969.25H682.969V973H666.578V969.828L675.078 961.641C676.224 960.495 677.005 959.573 677.422 958.875C677.849 958.177 678.062 957.438 678.062 956.656C678.062 955.802 677.724 955.083 677.047 954.5C676.37 953.917 675.516 953.625 674.484 953.625C673.391 953.625 672.484 953.969 671.766 954.656C671.047 955.333 670.688 956.193 670.688 957.234V957.312H666.312V957.234ZM691.531 973V954.781H691.438L685.688 958.75V954.5L691.516 950.453H696.203V973H691.531ZM716.766 970.328C715.151 972.443 712.927 973.5 710.094 973.5C707.26 973.5 705.031 972.448 703.406 970.344C701.781 968.229 700.969 965.344 700.969 961.688C700.969 958.052 701.781 955.188 703.406 953.094C705.042 950.99 707.271 949.938 710.094 949.938C712.917 949.938 715.141 950.984 716.766 953.078C718.391 955.172 719.203 958.036 719.203 961.672C719.203 965.318 718.391 968.203 716.766 970.328ZM706.906 967.609C707.677 969.016 708.74 969.719 710.094 969.719C711.448 969.719 712.505 969.021 713.266 967.625C714.026 966.219 714.406 964.24 714.406 961.688C714.406 959.156 714.021 957.198 713.25 955.812C712.49 954.417 711.438 953.719 710.094 953.719C708.75 953.719 707.693 954.417 706.922 955.812C706.151 957.208 705.766 959.167 705.766 961.688C705.766 964.229 706.146 966.203 706.906 967.609ZM732.719 965.828H722.453V961.844H732.719V965.828ZM741.188 973V954.781H741.094L735.344 958.75V954.5L741.172 950.453H745.859V973H741.188Z"
                            fill="white"
                          />
                        </g>
                        <g data-room="В-78__Г-232">
                          <rect
                            x="824"
                            y="690"
                            width="120"
                            height="128"
                            rx="12"
                            fill="#2563EB"
                          />
                          <path
                            d="M846.219 765H841.484V742.453H856.016V746.359H846.219V765ZM867.812 757.828H857.547V753.844H867.812V757.828ZM871.094 749.234C871.094 747.099 871.865 745.354 873.406 744C874.958 742.635 876.964 741.953 879.422 741.953C881.786 741.953 883.714 742.568 885.203 743.797C886.693 745.016 887.438 746.573 887.438 748.469C887.438 749.146 887.333 749.802 887.125 750.438C886.927 751.062 886.604 751.693 886.156 752.328C885.719 752.953 885.276 753.521 884.828 754.031C884.38 754.531 883.797 755.141 883.078 755.859L877.578 761.156V761.25H887.75V765H871.359V761.828L879.859 753.641C881.005 752.495 881.786 751.573 882.203 750.875C882.63 750.177 882.844 749.438 882.844 748.656C882.844 747.802 882.505 747.083 881.828 746.5C881.151 745.917 880.297 745.625 879.266 745.625C878.172 745.625 877.266 745.969 876.547 746.656C875.828 747.333 875.469 748.193 875.469 749.234V749.312H871.094V749.234ZM896.156 755.156V751.75H898.891C899.964 751.75 900.833 751.458 901.5 750.875C902.167 750.292 902.5 749.536 902.5 748.609C902.5 747.682 902.182 746.948 901.547 746.406C900.911 745.854 900.016 745.578 898.859 745.578C897.766 745.578 896.88 745.875 896.203 746.469C895.526 747.062 895.156 747.854 895.094 748.844H890.75C890.833 746.75 891.63 745.078 893.141 743.828C894.651 742.578 896.625 741.953 899.062 741.953C901.417 741.953 903.318 742.505 904.766 743.609C906.224 744.714 906.953 746.167 906.953 747.969C906.953 749.333 906.526 750.49 905.672 751.438C904.818 752.385 903.693 752.984 902.297 753.234V753.328C903.995 753.474 905.339 754.031 906.328 755C907.328 755.958 907.828 757.214 907.828 758.766C907.828 760.776 907 762.401 905.344 763.641C903.698 764.88 901.568 765.5 898.953 765.5C896.422 765.5 894.375 764.865 892.812 763.594C891.26 762.323 890.427 760.641 890.312 758.547H894.828C894.901 759.505 895.307 760.271 896.047 760.844C896.797 761.417 897.786 761.703 899.016 761.703C900.193 761.703 901.156 761.401 901.906 760.797C902.656 760.193 903.031 759.417 903.031 758.469C903.031 757.438 902.667 756.63 901.938 756.047C901.208 755.453 900.208 755.156 898.938 755.156H896.156ZM910.562 749.234C910.562 747.099 911.333 745.354 912.875 744C914.427 742.635 916.432 741.953 918.891 741.953C921.255 741.953 923.182 742.568 924.672 743.797C926.161 745.016 926.906 746.573 926.906 748.469C926.906 749.146 926.802 749.802 926.594 750.438C926.396 751.062 926.073 751.693 925.625 752.328C925.188 752.953 924.745 753.521 924.297 754.031C923.849 754.531 923.266 755.141 922.547 755.859L917.047 761.156V761.25H927.219V765H910.828V761.828L919.328 753.641C920.474 752.495 921.255 751.573 921.672 750.875C922.099 750.177 922.312 749.438 922.312 748.656C922.312 747.802 921.974 747.083 921.297 746.5C920.62 745.917 919.766 745.625 918.734 745.625C917.641 745.625 916.734 745.969 916.016 746.656C915.297 747.333 914.938 748.193 914.938 749.234V749.312H910.562V749.234Z"
                            fill="white"
                          />
                        </g>
                        <rect
                          x="1016"
                          y="282"
                          width="27"
                          height="50"
                          fill="#DADADA"
                        />
                        <g data-room="В-78__Г-231">
                          <rect
                            x="388"
                            y="690"
                            width="116"
                            height="128"
                            rx="12"
                            fill="#2563EB"
                          />
                          <path
                            d="M410.188 765H405.453V742.453H419.984V746.359H410.188V765ZM431.781 757.828H421.516V753.844H431.781V757.828ZM435.062 749.234C435.062 747.099 435.833 745.354 437.375 744C438.927 742.635 440.932 741.953 443.391 741.953C445.755 741.953 447.682 742.568 449.172 743.797C450.661 745.016 451.406 746.573 451.406 748.469C451.406 749.146 451.302 749.802 451.094 750.438C450.896 751.062 450.573 751.693 450.125 752.328C449.688 752.953 449.245 753.521 448.797 754.031C448.349 754.531 447.766 755.141 447.047 755.859L441.547 761.156V761.25H451.719V765H435.328V761.828L443.828 753.641C444.974 752.495 445.755 751.573 446.172 750.875C446.599 750.177 446.812 749.438 446.812 748.656C446.812 747.802 446.474 747.083 445.797 746.5C445.12 745.917 444.266 745.625 443.234 745.625C442.141 745.625 441.234 745.969 440.516 746.656C439.797 747.333 439.438 748.193 439.438 749.234V749.312H435.062V749.234ZM460.125 755.156V751.75H462.859C463.932 751.75 464.802 751.458 465.469 750.875C466.135 750.292 466.469 749.536 466.469 748.609C466.469 747.682 466.151 746.948 465.516 746.406C464.88 745.854 463.984 745.578 462.828 745.578C461.734 745.578 460.849 745.875 460.172 746.469C459.495 747.062 459.125 747.854 459.062 748.844H454.719C454.802 746.75 455.599 745.078 457.109 743.828C458.62 742.578 460.594 741.953 463.031 741.953C465.385 741.953 467.286 742.505 468.734 743.609C470.193 744.714 470.922 746.167 470.922 747.969C470.922 749.333 470.495 750.49 469.641 751.438C468.786 752.385 467.661 752.984 466.266 753.234V753.328C467.964 753.474 469.307 754.031 470.297 755C471.297 755.958 471.797 757.214 471.797 758.766C471.797 760.776 470.969 762.401 469.312 763.641C467.667 764.88 465.536 765.5 462.922 765.5C460.391 765.5 458.344 764.865 456.781 763.594C455.229 762.323 454.396 760.641 454.281 758.547H458.797C458.87 759.505 459.276 760.271 460.016 760.844C460.766 761.417 461.755 761.703 462.984 761.703C464.161 761.703 465.125 761.401 465.875 760.797C466.625 760.193 467 759.417 467 758.469C467 757.438 466.635 756.63 465.906 756.047C465.177 755.453 464.177 755.156 462.906 755.156H460.125ZM480.438 765V746.781H480.344L474.594 750.75V746.5L480.422 742.453H485.109V765H480.438Z"
                            fill="white"
                          />
                        </g>
                        <g data-room="В-78__Г-224">
                          <rect
                            y="64"
                            width="128"
                            height="136"
                            rx="12"
                            fill="#2563EB"
                          />
                          <path
                            d="M26.125 143H21.3906V120.453H35.9219V124.359H26.125V143ZM47.7188 135.828H37.4531V131.844H47.7188V135.828ZM51 127.234C51 125.099 51.7708 123.354 53.3125 122C54.8646 120.635 56.8698 119.953 59.3281 119.953C61.6927 119.953 63.6198 120.568 65.1094 121.797C66.599 123.016 67.3438 124.573 67.3438 126.469C67.3438 127.146 67.2396 127.802 67.0312 128.438C66.8333 129.062 66.5104 129.693 66.0625 130.328C65.625 130.953 65.1823 131.521 64.7344 132.031C64.2865 132.531 63.7031 133.141 62.9844 133.859L57.4844 139.156V139.25H67.6562V143H51.2656V139.828L59.7656 131.641C60.9115 130.495 61.6927 129.573 62.1094 128.875C62.5365 128.177 62.75 127.438 62.75 126.656C62.75 125.802 62.4115 125.083 61.7344 124.5C61.0573 123.917 60.2031 123.625 59.1719 123.625C58.0781 123.625 57.1719 123.969 56.4531 124.656C55.7344 125.333 55.375 126.193 55.375 127.234V127.312H51V127.234ZM70.3125 127.234C70.3125 125.099 71.0833 123.354 72.625 122C74.1771 120.635 76.1823 119.953 78.6406 119.953C81.0052 119.953 82.9323 120.568 84.4219 121.797C85.9115 123.016 86.6562 124.573 86.6562 126.469C86.6562 127.146 86.5521 127.802 86.3438 128.438C86.1458 129.062 85.8229 129.693 85.375 130.328C84.9375 130.953 84.4948 131.521 84.0469 132.031C83.599 132.531 83.0156 133.141 82.2969 133.859L76.7969 139.156V139.25H86.9688V143H70.5781V139.828L79.0781 131.641C80.224 130.495 81.0052 129.573 81.4219 128.875C81.849 128.177 82.0625 127.438 82.0625 126.656C82.0625 125.802 81.724 125.083 81.0469 124.5C80.3698 123.917 79.5156 123.625 78.4844 123.625C77.3906 123.625 76.4844 123.969 75.7656 124.656C75.0469 125.333 74.6875 126.193 74.6875 127.234V127.312H70.3125V127.234ZM100.234 143V138.984H89.0156V134.969C90.849 131.469 93.8646 126.63 98.0625 120.453H104.719V135.203H107.656V138.984H104.719V143H100.234ZM93.1562 135.219V135.344H100.328V123.797H100.234C98.4948 126.339 97.099 128.458 96.0469 130.156C94.9948 131.844 94.0312 133.531 93.1562 135.219Z"
                            fill="white"
                          />
                        </g>
                        <g>
                          <g data-room="В-78__Г-212">
                            <rect
                              x="320"
                              y="898"
                              width="176"
                              height="128"
                              rx="12"
                              fill="#2563EB"
                            />
                            <path
                              d="M372.609 973H367.875V950.453H382.406V954.359H372.609V973ZM394.203 965.828H383.938V961.844H394.203V965.828ZM397.484 957.234C397.484 955.099 398.255 953.354 399.797 952C401.349 950.635 403.354 949.953 405.812 949.953C408.177 949.953 410.104 950.568 411.594 951.797C413.083 953.016 413.828 954.573 413.828 956.469C413.828 957.146 413.724 957.802 413.516 958.438C413.318 959.062 412.995 959.693 412.547 960.328C412.109 960.953 411.667 961.521 411.219 962.031C410.771 962.531 410.188 963.141 409.469 963.859L403.969 969.156V969.25H414.141V973H397.75V969.828L406.25 961.641C407.396 960.495 408.177 959.573 408.594 958.875C409.021 958.177 409.234 957.438 409.234 956.656C409.234 955.802 408.896 955.083 408.219 954.5C407.542 953.917 406.688 953.625 405.656 953.625C404.562 953.625 403.656 953.969 402.938 954.656C402.219 955.333 401.859 956.193 401.859 957.234V957.312H397.484V957.234ZM422.703 973V954.781H422.609L416.859 958.75V954.5L422.688 950.453H427.375V973H422.703ZM432.172 957.234C432.172 955.099 432.943 953.354 434.484 952C436.036 950.635 438.042 949.953 440.5 949.953C442.865 949.953 444.792 950.568 446.281 951.797C447.771 953.016 448.516 954.573 448.516 956.469C448.516 957.146 448.411 957.802 448.203 958.438C448.005 959.062 447.682 959.693 447.234 960.328C446.797 960.953 446.354 961.521 445.906 962.031C445.458 962.531 444.875 963.141 444.156 963.859L438.656 969.156V969.25H448.828V973H432.438V969.828L440.938 961.641C442.083 960.495 442.865 959.573 443.281 958.875C443.708 958.177 443.922 957.438 443.922 956.656C443.922 955.802 443.583 955.083 442.906 954.5C442.229 953.917 441.375 953.625 440.344 953.625C439.25 953.625 438.344 953.969 437.625 954.656C436.906 955.333 436.547 956.193 436.547 957.234V957.312H432.172V957.234Z"
                              fill="white"
                            />
                          </g>
                          <path
                            d="M356 898V954H196C189.373 954 184 948.627 184 942V910C184 903.373 189.373 898 196 898H356Z"
                            fill="#2563EB"
                          />
                        </g>
                        <rect
                          x="114"
                          y="282"
                          width="22"
                          height="50"
                          fill="#DADADA"
                        />
                        <g>
                          <rect
                            y="282"
                            width="128"
                            height="50"
                            rx="12"
                            fill="white"
                          />
                          <g>
                            <path
                              d="M86.4546 290H78.962V297.5C78.962 297.625 78.9463 297.719 78.9151 297.781C78.8527 298.125 78.6888 298.414 78.4234 298.648C78.1581 298.883 77.838 299 77.4634 299H69.9707V306.5C69.9707 306.625 69.9551 306.719 69.9239 306.781C69.8615 307.125 69.6976 307.414 69.4322 307.648C69.1668 307.883 68.8468 308 68.4722 308H60.9795V315.5C60.9795 315.625 60.9639 315.719 60.9327 315.781C60.8702 316.125 60.7063 316.414 60.441 316.648C60.1756 316.883 59.8556 317 59.481 317H51.9883V324.5C51.9883 324.625 51.9727 324.719 51.9415 324.781C51.879 325.125 51.7151 325.414 51.4498 325.648C51.1844 325.883 50.8644 326 50.4898 326H41.4985C41.0927 326 40.7415 325.852 40.4449 325.555C40.1483 325.258 40 324.906 40 324.5C40 324.094 40.1483 323.742 40.4449 323.445C40.7415 323.148 41.0927 323 41.4985 323H48.9912V315.5C48.9912 315.375 49.0068 315.281 49.038 315.219C49.1005 314.875 49.2722 314.586 49.5532 314.352C49.8341 314.117 50.1463 314 50.4898 314H57.9824V306.5C57.9824 306.375 57.998 306.281 58.0293 306.219C58.0917 305.875 58.2634 305.586 58.5444 305.352C58.8254 305.117 59.1376 305 59.481 305H66.9737V297.5C66.9737 297.406 66.9893 297.313 67.0205 297.219C67.0829 296.875 67.2546 296.586 67.5356 296.352C67.8166 296.117 68.1288 296 68.4722 296H75.9649V288.5C75.9649 288.375 75.9805 288.281 76.0117 288.219C76.0741 287.875 76.238 287.586 76.5034 287.352C76.7688 287.117 77.0888 287 77.4634 287H86.4546C86.8605 287 87.2117 287.148 87.5083 287.445C87.8049 287.742 87.9532 288.094 87.9532 288.5C87.9532 288.906 87.8049 289.258 87.5083 289.555C87.2117 289.852 86.8605 290 86.4546 290Z"
                              fill="black"
                            />
                          </g>
                        </g>
                        <g>
                          <rect
                            x="1024"
                            y="282"
                            width="128"
                            height="50"
                            rx="12"
                            fill="white"
                          />
                          <g>
                            <path
                              d="M1110.45 290H1102.96V297.5C1102.96 297.625 1102.95 297.719 1102.92 297.781C1102.85 298.125 1102.69 298.414 1102.42 298.648C1102.16 298.883 1101.84 299 1101.46 299H1093.97V306.5C1093.97 306.625 1093.96 306.719 1093.92 306.781C1093.86 307.125 1093.7 307.414 1093.43 307.648C1093.17 307.883 1092.85 308 1092.47 308H1084.98V315.5C1084.98 315.625 1084.96 315.719 1084.93 315.781C1084.87 316.125 1084.71 316.414 1084.44 316.648C1084.18 316.883 1083.86 317 1083.48 317H1075.99V324.5C1075.99 324.625 1075.97 324.719 1075.94 324.781C1075.88 325.125 1075.72 325.414 1075.45 325.648C1075.18 325.883 1074.86 326 1074.49 326H1065.5C1065.09 326 1064.74 325.852 1064.44 325.555C1064.15 325.258 1064 324.906 1064 324.5C1064 324.094 1064.15 323.742 1064.44 323.445C1064.74 323.148 1065.09 323 1065.5 323H1072.99V315.5C1072.99 315.375 1073.01 315.281 1073.04 315.219C1073.1 314.875 1073.27 314.586 1073.55 314.352C1073.83 314.117 1074.15 314 1074.49 314H1081.98V306.5C1081.98 306.375 1082 306.281 1082.03 306.219C1082.09 305.875 1082.26 305.586 1082.54 305.352C1082.83 305.117 1083.14 305 1083.48 305H1090.97V297.5C1090.97 297.406 1090.99 297.313 1091.02 297.219C1091.08 296.875 1091.25 296.586 1091.54 296.352C1091.82 296.117 1092.13 296 1092.47 296H1099.96V288.5C1099.96 288.375 1099.98 288.281 1100.01 288.219C1100.07 287.875 1100.24 287.586 1100.5 287.352C1100.77 287.117 1101.09 287 1101.46 287H1110.45C1110.86 287 1111.21 287.148 1111.51 287.445C1111.8 287.742 1111.95 288.094 1111.95 288.5C1111.95 288.906 1111.8 289.258 1111.51 289.555C1111.21 289.852 1110.86 290 1110.45 290Z"
                              fill="black"
                            />
                          </g>
                        </g>
                        <rect
                          x="512"
                          y="790"
                          width="128"
                          height="36"
                          fill="#DADADA"
                        />
                        <g>
                          <rect
                            x="512"
                            y="650"
                            width="128"
                            height="168"
                            rx="12"
                            fill="white"
                          />
                          <g>
                            <path
                              d="M598.455 717H590.962V724.5C590.962 724.625 590.946 724.719 590.915 724.781C590.853 725.125 590.689 725.414 590.423 725.648C590.158 725.883 589.838 726 589.463 726H581.971V733.5C581.971 733.625 581.955 733.719 581.924 733.781C581.861 734.125 581.698 734.414 581.432 734.648C581.167 734.883 580.847 735 580.472 735H572.98V742.5C572.98 742.625 572.964 742.719 572.933 742.781C572.87 743.125 572.706 743.414 572.441 743.648C572.176 743.883 571.856 744 571.481 744H563.988V751.5C563.988 751.625 563.973 751.719 563.941 751.781C563.879 752.125 563.715 752.414 563.45 752.648C563.184 752.883 562.864 753 562.49 753H553.499C553.093 753 552.741 752.852 552.445 752.555C552.148 752.258 552 751.906 552 751.5C552 751.094 552.148 750.742 552.445 750.445C552.741 750.148 553.093 750 553.499 750H560.991V742.5C560.991 742.375 561.007 742.281 561.038 742.219C561.1 741.875 561.272 741.586 561.553 741.352C561.834 741.117 562.146 741 562.49 741H569.982V733.5C569.982 733.375 569.998 733.281 570.029 733.219C570.092 732.875 570.263 732.586 570.544 732.352C570.825 732.117 571.138 732 571.481 732H578.974V724.5C578.974 724.406 578.989 724.313 579.02 724.219C579.083 723.875 579.255 723.586 579.536 723.352C579.817 723.117 580.129 723 580.472 723H587.965V715.5C587.965 715.375 587.98 715.281 588.012 715.219C588.074 714.875 588.238 714.586 588.503 714.352C588.769 714.117 589.089 714 589.463 714H598.455C598.86 714 599.212 714.148 599.508 714.445C599.805 714.742 599.953 715.094 599.953 715.5C599.953 715.906 599.805 716.258 599.508 716.555C599.212 716.852 598.86 717 598.455 717Z"
                              fill="black"
                            />
                          </g>
                        </g>
                        <rect
                          x="716"
                          y="818"
                          width="32"
                          height="8"
                          fill="#DADADA"
                        />
                        <rect
                          x="438"
                          y="818"
                          width="16"
                          height="8"
                          fill="#DADADA"
                        />
                        <rect
                          x="438"
                          y="890"
                          width="16"
                          height="8"
                          fill="#DADADA"
                        />
                        <rect
                          x="588"
                          y="890"
                          width="16"
                          height="8"
                          fill="#DADADA"
                        />
                        <rect
                          x="558"
                          y="958"
                          width="16"
                          height="8"
                          fill="#DADADA"
                        />
                        <rect
                          x="144"
                          y="885"
                          width="16"
                          height="13"
                          fill="#DADADA"
                        />
                        <rect
                          x="210"
                          y="954"
                          width="16"
                          height="8"
                          fill="#DADADA"
                        />
                        <rect
                          x="346"
                          y="818"
                          width="16"
                          height="8"
                          fill="#DADADA"
                        />
                        <rect
                          x="286"
                          y="818"
                          width="16"
                          height="8"
                          fill="#DADADA"
                        />
                        <rect
                          x="226"
                          y="818"
                          width="16"
                          height="8"
                          fill="#DADADA"
                        />
                        <rect
                          x="98"
                          y="766"
                          width="16"
                          height="8"
                          fill="#DADADA"
                        />
                        <rect
                          x="98"
                          y="828"
                          width="16"
                          height="8"
                          fill="#DADADA"
                        />
                        <rect
                          x="128"
                          y="793"
                          width="8"
                          height="16"
                          fill="#DADADA"
                        />
                        <rect
                          x="128"
                          y="669"
                          width="8"
                          height="16"
                          fill="#DADADA"
                        />
                        <rect
                          x="128"
                          y="607"
                          width="8"
                          height="16"
                          fill="#DADADA"
                        />
                        <rect
                          x="128"
                          y="545"
                          width="8"
                          height="16"
                          fill="#DADADA"
                        />
                        <rect
                          x="128"
                          y="483"
                          width="8"
                          height="16"
                          fill="#DADADA"
                        />
                        <rect
                          x="128"
                          y="421"
                          width="8"
                          height="16"
                          fill="#DADADA"
                        />
                        <rect
                          x="128"
                          y="359"
                          width="8"
                          height="16"
                          fill="#DADADA"
                        />
                        <rect
                          x="128"
                          y="233"
                          width="8"
                          height="16"
                          fill="#DADADA"
                        />
                        <rect
                          x="672"
                          y="234"
                          width="8"
                          height="16"
                          fill="#DADADA"
                        />
                        <rect
                          x="944"
                          y="234"
                          width="8"
                          height="16"
                          fill="#DADADA"
                        />
                        <rect
                          x="1016"
                          y="158"
                          width="8"
                          height="16"
                          fill="#DADADA"
                        />
                        <rect
                          x="1016"
                          y="236"
                          width="8"
                          height="16"
                          fill="#DADADA"
                        />
                        <rect
                          x="1016"
                          y="387"
                          width="8"
                          height="16"
                          fill="#DADADA"
                        />
                        <rect
                          x="1016"
                          y="480"
                          width="8"
                          height="16"
                          fill="#DADADA"
                        />
                        <rect
                          x="1016"
                          y="641"
                          width="8"
                          height="16"
                          fill="#DADADA"
                        />
                        <rect
                          x="1016"
                          y="759"
                          width="8"
                          height="16"
                          fill="#DADADA"
                        />
                        <rect
                          x="952"
                          y="922"
                          width="8"
                          height="16"
                          fill="#DADADA"
                        />
                        <rect
                          x="748"
                          y="922"
                          width="8"
                          height="16"
                          fill="#DADADA"
                        />
                        <rect
                          x="976"
                          y="898"
                          width="8"
                          height="16"
                          transform="rotate(-90 976 898)"
                          fill="#DADADA"
                        />
                        <rect
                          x="846"
                          y="898"
                          width="8"
                          height="16"
                          transform="rotate(-90 846 898)"
                          fill="#DADADA"
                        />
                        <rect
                          x="778"
                          y="898"
                          width="8"
                          height="16"
                          transform="rotate(-90 778 898)"
                          fill="#DADADA"
                        />
                        <rect
                          x="846"
                          y="826"
                          width="8"
                          height="16"
                          transform="rotate(-90 846 826)"
                          fill="#DADADA"
                        />
                        <rect
                          x="1048"
                          y="830"
                          width="8"
                          height="16"
                          transform="rotate(-90 1048 830)"
                          fill="#DADADA"
                        />
                        <rect
                          x="1048"
                          y="526"
                          width="8"
                          height="16"
                          transform="rotate(-90 1048 526)"
                          fill="#DADADA"
                        />
                        <rect
                          x="128"
                          y="124"
                          width="8"
                          height="16"
                          fill="#DADADA"
                        />
                        <rect
                          x="160"
                          y="58"
                          width="16"
                          height="7"
                          fill="#DADADA"
                        />
                        <rect
                          x="238"
                          y="130"
                          width="16"
                          height="8"
                          fill="#DADADA"
                        />
                        <rect
                          x="322"
                          y="130"
                          width="16"
                          height="8"
                          fill="#DADADA"
                        />
                        <rect
                          x="406"
                          y="130"
                          width="16"
                          height="8"
                          fill="#DADADA"
                        />
                        <rect
                          x="490"
                          y="130"
                          width="16"
                          height="8"
                          fill="#DADADA"
                        />
                        <rect
                          x="490"
                          y="202"
                          width="16"
                          height="8"
                          fill="#DADADA"
                        />
                        <rect
                          x="632"
                          y="206"
                          width="16"
                          height="8"
                          fill="#DADADA"
                        />
                        <rect
                          x="736"
                          y="206"
                          width="16"
                          height="8"
                          fill="#DADADA"
                        />
                        <rect
                          x="872"
                          y="206"
                          width="16"
                          height="8"
                          fill="#DADADA"
                        />
                        <rect
                          x="976"
                          y="128"
                          width="16"
                          height="8"
                          fill="#DADADA"
                        />
                        <rect
                          x="280"
                          y="202"
                          width="16"
                          height="8"
                          fill="#DADADA"
                        />
                        <g>
                          <rect
                            x="648"
                            y="690"
                            width="64"
                            height="128"
                            rx="12"
                            fill="#60A5FA"
                          />
                          <g>
                            <path
                              d="M680 740.5C682.899 740.5 685.25 738.149 685.25 735.25C685.25 732.351 682.899 730 680 730C677.101 730 674.75 732.351 674.75 735.25C674.75 738.149 677.101 740.5 680 740.5Z"
                              fill="white"
                            />
                            <path
                              d="M684.5 742H675.5C673.91 742.005 672.387 742.638 671.263 743.763C670.138 744.887 669.505 746.41 669.5 748V758.08C669.5 759.097 670.29 759.962 671.307 759.999C671.558 760.008 671.81 759.967 672.045 759.877C672.28 759.787 672.495 759.65 672.677 759.475C672.858 759.3 673.002 759.09 673.101 758.858C673.199 758.626 673.25 758.377 673.25 758.125V748.775C673.248 748.582 673.318 748.395 673.448 748.251C673.578 748.108 673.758 748.019 673.95 748.002C674.053 747.995 674.156 748.009 674.253 748.044C674.349 748.079 674.438 748.133 674.513 748.203C674.588 748.274 674.648 748.359 674.689 748.453C674.729 748.547 674.75 748.649 674.75 748.752V775.844C674.75 776.416 674.977 776.964 675.382 777.368C675.786 777.773 676.334 778 676.906 778C677.478 778 678.027 777.773 678.431 777.368C678.835 776.964 679.062 776.416 679.062 775.844V762.469C679.059 762.227 679.147 761.993 679.31 761.813C679.472 761.633 679.696 761.521 679.937 761.5C680.065 761.491 680.194 761.509 680.315 761.552C680.436 761.596 680.547 761.663 680.641 761.751C680.735 761.839 680.81 761.946 680.861 762.064C680.912 762.182 680.938 762.309 680.938 762.438V775.844C680.938 776.416 681.165 776.964 681.569 777.368C681.973 777.773 682.522 778 683.094 778C683.666 778 684.214 777.773 684.618 777.368C685.023 776.964 685.25 776.416 685.25 775.844V748.775C685.248 748.582 685.318 748.395 685.448 748.251C685.578 748.108 685.758 748.019 685.95 748.002C686.053 747.995 686.156 748.009 686.253 748.044C686.349 748.079 686.438 748.133 686.513 748.203C686.588 748.274 686.648 748.359 686.689 748.453C686.729 748.547 686.75 748.649 686.75 748.752V758.082C686.75 759.099 687.54 759.964 688.557 760.001C688.809 760.01 689.06 759.968 689.295 759.878C689.531 759.788 689.746 759.651 689.927 759.476C690.109 759.301 690.253 759.091 690.351 758.859C690.45 758.627 690.5 758.377 690.5 758.125V748C690.495 746.41 689.862 744.887 688.737 743.763C687.613 742.638 686.09 742.005 684.5 742Z"
                              fill="white"
                            />
                          </g>
                        </g>
                        <g>
                          <rect
                            x="721"
                            y="690"
                            width="64"
                            height="128"
                            rx="12"
                            fill="#60A5FA"
                          />
                          <g clip-path="url(#clip0_979_1671)">
                            <path
                              d="M752.977 740.5C755.876 740.5 758.227 738.149 758.227 735.25C758.227 732.351 755.876 730 752.977 730C750.077 730 747.727 732.351 747.727 735.25C747.727 738.149 750.077 740.5 752.977 740.5Z"
                              fill="white"
                            />
                            <path
                              d="M765.996 756.053L765.028 752.827V752.817L762.922 745.799H762.918L762.682 745.007C762.424 744.138 761.892 743.376 761.166 742.834C760.439 742.292 759.557 741.999 758.651 741.999H747.401C746.495 741.999 745.613 742.291 744.886 742.833C744.16 743.375 743.628 744.138 743.37 745.007L743.135 745.799H743.129L741.023 752.817V752.827L740.051 756.053C739.759 757.027 740.267 758.084 741.23 758.41C741.468 758.491 741.721 758.523 741.972 758.505C742.223 758.486 742.468 758.417 742.692 758.302C742.916 758.187 743.115 758.027 743.276 757.834C743.437 757.64 743.557 757.416 743.63 757.174L746.028 749.182L746.231 748.504C746.291 748.339 746.406 748.199 746.558 748.11C746.71 748.021 746.888 747.989 747.062 748.018C747.235 748.047 747.393 748.137 747.507 748.27C747.622 748.404 747.685 748.574 747.687 748.75C747.687 748.801 747.682 748.851 747.671 748.901L743.571 762.569C743.504 762.793 743.49 763.029 743.531 763.26C743.571 763.49 743.665 763.707 743.804 763.895C743.944 764.083 744.125 764.235 744.334 764.34C744.543 764.445 744.774 764.5 745.008 764.5H747.726V775.252C747.726 776.795 748.714 778 749.976 778C751.239 778 752.226 776.795 752.226 775.252V764.5H753.726V775.252C753.726 776.795 754.714 778 755.976 778C757.239 778 758.226 776.795 758.226 775.252V764.5H761.039C761.273 764.5 761.504 764.445 761.713 764.34C761.922 764.236 762.103 764.083 762.243 763.895C762.382 763.708 762.476 763.49 762.517 763.26C762.557 763.029 762.543 762.793 762.476 762.569L758.376 748.899C758.365 748.85 758.36 748.8 758.361 748.75C758.361 748.573 758.425 748.403 758.539 748.268C758.653 748.134 758.811 748.044 758.985 748.015C759.159 747.985 759.338 748.018 759.49 748.107C759.643 748.197 759.758 748.337 759.817 748.503L760.021 749.181L762.418 757.173C762.491 757.414 762.611 757.638 762.772 757.832C762.934 758.025 763.132 758.184 763.356 758.299C763.58 758.414 763.825 758.483 764.076 758.501C764.327 758.52 764.579 758.487 764.817 758.406C765.78 758.084 766.288 757.027 765.996 756.053Z"
                              fill="white"
                            />
                          </g>
                        </g>
                        <g data-room="В-78__Г-210">
                          <rect
                            x="756"
                            y="898"
                            width="60"
                            height="128"
                            rx="12"
                            fill="#2563EB"
                          />
                          <path
                            d="M797 998.156V1002.89H774.453V988.359H778.359V998.156H797ZM789.828 976.562V986.828H785.844V976.562H789.828ZM781.234 973.281C779.099 973.281 777.354 972.51 776 970.969C774.635 969.417 773.953 967.411 773.953 964.953C773.953 962.589 774.568 960.661 775.797 959.172C777.016 957.682 778.573 956.938 780.469 956.938C781.146 956.938 781.802 957.042 782.438 957.25C783.062 957.448 783.693 957.771 784.328 958.219C784.953 958.656 785.521 959.099 786.031 959.547C786.531 959.995 787.141 960.578 787.859 961.297L793.156 966.797H793.25V956.625H797V973.016H793.828L785.641 964.516C784.495 963.37 783.573 962.589 782.875 962.172C782.177 961.745 781.438 961.531 780.656 961.531C779.802 961.531 779.083 961.87 778.5 962.547C777.917 963.224 777.625 964.078 777.625 965.109C777.625 966.203 777.969 967.109 778.656 967.828C779.333 968.547 780.193 968.906 781.234 968.906H781.312V973.281H781.234ZM797 948.062H778.781V948.156L782.75 953.906H778.5L774.453 948.078V943.391H797V948.062ZM794.328 922.828C796.443 924.443 797.5 926.667 797.5 929.5C797.5 932.333 796.448 934.562 794.344 936.188C792.229 937.812 789.344 938.625 785.688 938.625C782.052 938.625 779.188 937.812 777.094 936.188C774.99 934.552 773.938 932.323 773.938 929.5C773.938 926.677 774.984 924.453 777.078 922.828C779.172 921.203 782.036 920.391 785.672 920.391C789.318 920.391 792.203 921.203 794.328 922.828ZM791.609 932.688C793.016 931.917 793.719 930.854 793.719 929.5C793.719 928.146 793.021 927.089 791.625 926.328C790.219 925.568 788.24 925.188 785.688 925.188C783.156 925.188 781.198 925.573 779.812 926.344C778.417 927.104 777.719 928.156 777.719 929.5C777.719 930.844 778.417 931.901 779.812 932.672C781.208 933.443 783.167 933.828 785.688 933.828C788.229 933.828 790.203 933.448 791.609 932.688Z"
                            fill="white"
                          />
                        </g>
                        <g data-room="В-78__Г-229">
                          <rect
                            x="268"
                            y="690"
                            width="52"
                            height="128"
                            rx="12"
                            fill="#2563EB"
                          />
                          <path
                            d="M305 792.031V796.766H282.453V782.234H286.359V792.031H305ZM297.828 770.438V780.703H293.844V770.438H297.828ZM289.234 767.156C287.099 767.156 285.354 766.385 284 764.844C282.635 763.292 281.953 761.286 281.953 758.828C281.953 756.464 282.568 754.536 283.797 753.047C285.016 751.557 286.573 750.812 288.469 750.812C289.146 750.812 289.802 750.917 290.438 751.125C291.062 751.323 291.693 751.646 292.328 752.094C292.953 752.531 293.521 752.974 294.031 753.422C294.531 753.87 295.141 754.453 295.859 755.172L301.156 760.672H301.25V750.5H305V766.891H301.828L293.641 758.391C292.495 757.245 291.573 756.464 290.875 756.047C290.177 755.62 289.438 755.406 288.656 755.406C287.802 755.406 287.083 755.745 286.5 756.422C285.917 757.099 285.625 757.953 285.625 758.984C285.625 760.078 285.969 760.984 286.656 761.703C287.333 762.422 288.193 762.781 289.234 762.781H289.312V767.156H289.234ZM289.234 747.844C287.099 747.844 285.354 747.073 284 745.531C282.635 743.979 281.953 741.974 281.953 739.516C281.953 737.151 282.568 735.224 283.797 733.734C285.016 732.245 286.573 731.5 288.469 731.5C289.146 731.5 289.802 731.604 290.438 731.812C291.062 732.01 291.693 732.333 292.328 732.781C292.953 733.219 293.521 733.661 294.031 734.109C294.531 734.557 295.141 735.141 295.859 735.859L301.156 741.359H301.25V731.188H305V747.578H301.828L293.641 739.078C292.495 737.932 291.573 737.151 290.875 736.734C290.177 736.307 289.438 736.094 288.656 736.094C287.802 736.094 287.083 736.432 286.5 737.109C285.917 737.786 285.625 738.641 285.625 739.672C285.625 740.766 285.969 741.672 286.656 742.391C287.333 743.109 288.193 743.469 289.234 743.469H289.312V747.844H289.234ZM305.5 720C305.5 722.156 304.922 724.005 303.766 725.547C302.599 727.089 301.094 728.016 299.25 728.328V723.672C300.01 723.443 300.62 722.99 301.078 722.312C301.536 721.625 301.766 720.828 301.766 719.922C301.766 718.349 301.052 717.13 299.625 716.266C298.198 715.391 296.203 714.984 293.641 715.047V715.094V715.125V715.141C294.766 715.557 295.661 716.297 296.328 717.359C296.995 718.422 297.328 719.682 297.328 721.141C297.328 723.276 296.625 725.057 295.219 726.484C293.802 727.911 292.026 728.625 289.891 728.625C287.578 728.625 285.677 727.807 284.188 726.172C282.688 724.536 281.938 722.458 281.938 719.938C281.938 718.302 282.292 716.839 283 715.547C283.708 714.245 284.729 713.203 286.062 712.422C288 711.161 290.49 710.531 293.531 710.531C297.271 710.531 300.203 711.37 302.328 713.047C304.443 714.714 305.5 717.031 305.5 720ZM292.641 722.844C293.401 722.062 293.781 721.083 293.781 719.906C293.781 718.729 293.401 717.75 292.641 716.969C291.87 716.177 290.917 715.781 289.781 715.781C288.635 715.781 287.672 716.177 286.891 716.969C286.099 717.76 285.703 718.729 285.703 719.875C285.703 721.031 286.094 722.01 286.875 722.812C287.656 723.615 288.615 724.016 289.75 724.016C290.906 724.016 291.87 723.625 292.641 722.844Z"
                            fill="white"
                          />
                        </g>
                        <g data-room="В-78__Г-230">
                          <rect
                            x="328"
                            y="690"
                            width="52"
                            height="128"
                            rx="12"
                            fill="#2563EB"
                          />
                          <path
                            d="M365 792.5V797.234H342.453V782.703H346.359V792.5H365ZM357.828 770.906V781.172H353.844V770.906H357.828ZM349.234 767.625C347.099 767.625 345.354 766.854 344 765.312C342.635 763.76 341.953 761.755 341.953 759.297C341.953 756.932 342.568 755.005 343.797 753.516C345.016 752.026 346.573 751.281 348.469 751.281C349.146 751.281 349.802 751.385 350.438 751.594C351.062 751.792 351.693 752.115 352.328 752.562C352.953 753 353.521 753.443 354.031 753.891C354.531 754.339 355.141 754.922 355.859 755.641L361.156 761.141H361.25V750.969H365V767.359H361.828L353.641 758.859C352.495 757.714 351.573 756.932 350.875 756.516C350.177 756.089 349.438 755.875 348.656 755.875C347.802 755.875 347.083 756.214 346.5 756.891C345.917 757.568 345.625 758.422 345.625 759.453C345.625 760.547 345.969 761.453 346.656 762.172C347.333 762.891 348.193 763.25 349.234 763.25H349.312V767.625H349.234ZM355.156 742.562H351.75V739.828C351.75 738.755 351.458 737.885 350.875 737.219C350.292 736.552 349.536 736.219 348.609 736.219C347.682 736.219 346.948 736.536 346.406 737.172C345.854 737.807 345.578 738.703 345.578 739.859C345.578 740.953 345.875 741.839 346.469 742.516C347.062 743.193 347.854 743.562 348.844 743.625V747.969C346.75 747.885 345.078 747.089 343.828 745.578C342.578 744.068 341.953 742.094 341.953 739.656C341.953 737.302 342.505 735.401 343.609 733.953C344.714 732.495 346.167 731.766 347.969 731.766C349.333 731.766 350.49 732.193 351.438 733.047C352.385 733.901 352.984 735.026 353.234 736.422H353.328C353.474 734.724 354.031 733.38 355 732.391C355.958 731.391 357.214 730.891 358.766 730.891C360.776 730.891 362.401 731.719 363.641 733.375C364.88 735.021 365.5 737.151 365.5 739.766C365.5 742.297 364.865 744.344 363.594 745.906C362.323 747.458 360.641 748.292 358.547 748.406V743.891C359.505 743.818 360.271 743.411 360.844 742.672C361.417 741.922 361.703 740.932 361.703 739.703C361.703 738.526 361.401 737.562 360.797 736.812C360.193 736.062 359.417 735.688 358.469 735.688C357.438 735.688 356.63 736.052 356.047 736.781C355.453 737.51 355.156 738.51 355.156 739.781V742.562ZM362.328 712.484C364.443 714.099 365.5 716.323 365.5 719.156C365.5 721.99 364.448 724.219 362.344 725.844C360.229 727.469 357.344 728.281 353.688 728.281C350.052 728.281 347.188 727.469 345.094 725.844C342.99 724.208 341.938 721.979 341.938 719.156C341.938 716.333 342.984 714.109 345.078 712.484C347.172 710.859 350.036 710.047 353.672 710.047C357.318 710.047 360.203 710.859 362.328 712.484ZM359.609 722.344C361.016 721.573 361.719 720.51 361.719 719.156C361.719 717.802 361.021 716.745 359.625 715.984C358.219 715.224 356.24 714.844 353.688 714.844C351.156 714.844 349.198 715.229 347.812 716C346.417 716.76 345.719 717.812 345.719 719.156C345.719 720.5 346.417 721.557 347.812 722.328C349.208 723.099 351.167 723.484 353.688 723.484C356.229 723.484 358.203 723.104 359.609 722.344Z"
                            fill="white"
                          />
                        </g>
                        <g data-room="В-78__Г-228">
                          <rect
                            x="208"
                            y="690"
                            width="52"
                            height="128"
                            rx="12"
                            fill="#2563EB"
                          />
                          <path
                            d="M245 792.141V796.875H222.453V782.344H226.359V792.141H245ZM237.828 770.547V780.812H233.844V770.547H237.828ZM229.234 767.266C227.099 767.266 225.354 766.495 224 764.953C222.635 763.401 221.953 761.396 221.953 758.938C221.953 756.573 222.568 754.646 223.797 753.156C225.016 751.667 226.573 750.922 228.469 750.922C229.146 750.922 229.802 751.026 230.438 751.234C231.062 751.432 231.693 751.755 232.328 752.203C232.953 752.641 233.521 753.083 234.031 753.531C234.531 753.979 235.141 754.562 235.859 755.281L241.156 760.781H241.25V750.609H245V767H241.828L233.641 758.5C232.495 757.354 231.573 756.573 230.875 756.156C230.177 755.729 229.438 755.516 228.656 755.516C227.802 755.516 227.083 755.854 226.5 756.531C225.917 757.208 225.625 758.062 225.625 759.094C225.625 760.188 225.969 761.094 226.656 761.812C227.333 762.531 228.193 762.891 229.234 762.891H229.312V767.266H229.234ZM229.234 747.953C227.099 747.953 225.354 747.182 224 745.641C222.635 744.089 221.953 742.083 221.953 739.625C221.953 737.26 222.568 735.333 223.797 733.844C225.016 732.354 226.573 731.609 228.469 731.609C229.146 731.609 229.802 731.714 230.438 731.922C231.062 732.12 231.693 732.443 232.328 732.891C232.953 733.328 233.521 733.771 234.031 734.219C234.531 734.667 235.141 735.25 235.859 735.969L241.156 741.469H241.25V731.297H245V747.688H241.828L233.641 739.188C232.495 738.042 231.573 737.26 230.875 736.844C230.177 736.417 229.438 736.203 228.656 736.203C227.802 736.203 227.083 736.542 226.5 737.219C225.917 737.896 225.625 738.75 225.625 739.781C225.625 740.875 225.969 741.781 226.656 742.5C227.333 743.219 228.193 743.578 229.234 743.578H229.312V747.953H229.234ZM245.5 719.531C245.5 722.26 244.891 724.469 243.672 726.156C242.443 727.833 240.849 728.672 238.891 728.672C237.411 728.672 236.146 728.182 235.094 727.203C234.031 726.224 233.37 724.948 233.109 723.375H233.016C232.714 724.688 232.099 725.75 231.172 726.562C230.234 727.365 229.146 727.766 227.906 727.766C226.177 727.766 224.755 726.995 223.641 725.453C222.516 723.911 221.953 721.938 221.953 719.531C221.953 717.115 222.516 715.141 223.641 713.609C224.755 712.078 226.182 711.312 227.922 711.312C229.141 711.312 230.219 711.714 231.156 712.516C232.083 713.318 232.703 714.375 233.016 715.688H233.109C233.38 714.104 234.047 712.828 235.109 711.859C236.161 710.88 237.427 710.391 238.906 710.391C240.865 710.391 242.453 711.24 243.672 712.938C244.891 714.625 245.5 716.823 245.5 719.531ZM241.078 722.578C241.734 721.786 242.062 720.771 242.062 719.531C242.062 718.292 241.734 717.281 241.078 716.5C240.411 715.719 239.568 715.328 238.547 715.328C237.526 715.328 236.688 715.719 236.031 716.5C235.365 717.281 235.031 718.292 235.031 719.531C235.031 720.771 235.365 721.786 236.031 722.578C236.688 723.359 237.526 723.75 238.547 723.75C239.568 723.75 240.411 723.359 241.078 722.578ZM230.719 722.094C231.302 721.427 231.594 720.573 231.594 719.531C231.594 718.49 231.302 717.635 230.719 716.969C230.125 716.302 229.38 715.969 228.484 715.969C227.578 715.969 226.833 716.302 226.25 716.969C225.656 717.635 225.359 718.49 225.359 719.531C225.359 720.573 225.656 721.427 226.25 722.094C226.833 722.76 227.578 723.094 228.484 723.094C229.391 723.094 230.135 722.76 230.719 722.094Z"
                            fill="white"
                          />
                        </g>
                        <g data-room="В-78__Г-207-1">
                          <rect
                            x="1024"
                            y="830"
                            width="128"
                            height="60"
                            rx="12"
                            fill="#2563EB"
                          />
                          <path
                            d="M1036.3 871H1031.56V848.453H1046.09V852.359H1036.3V871ZM1057.89 863.828H1047.62V859.844H1057.89V863.828ZM1061.17 855.234C1061.17 853.099 1061.94 851.354 1063.48 850C1065.04 848.635 1067.04 847.953 1069.5 847.953C1071.86 847.953 1073.79 848.568 1075.28 849.797C1076.77 851.016 1077.52 852.573 1077.52 854.469C1077.52 855.146 1077.41 855.802 1077.2 856.438C1077.01 857.062 1076.68 857.693 1076.23 858.328C1075.8 858.953 1075.35 859.521 1074.91 860.031C1074.46 860.531 1073.88 861.141 1073.16 861.859L1067.66 867.156V867.25H1077.83V871H1061.44V867.828L1069.94 859.641C1071.08 858.495 1071.86 857.573 1072.28 856.875C1072.71 856.177 1072.92 855.438 1072.92 854.656C1072.92 853.802 1072.58 853.083 1071.91 852.5C1071.23 851.917 1070.38 851.625 1069.34 851.625C1068.25 851.625 1067.34 851.969 1066.62 852.656C1065.91 853.333 1065.55 854.193 1065.55 855.234V855.312H1061.17V855.234ZM1096.16 868.328C1094.54 870.443 1092.32 871.5 1089.48 871.5C1086.65 871.5 1084.42 870.448 1082.8 868.344C1081.17 866.229 1080.36 863.344 1080.36 859.688C1080.36 856.052 1081.17 853.188 1082.8 851.094C1084.43 848.99 1086.66 847.938 1089.48 847.938C1092.31 847.938 1094.53 848.984 1096.16 851.078C1097.78 853.172 1098.59 856.036 1098.59 859.672C1098.59 863.318 1097.78 866.203 1096.16 868.328ZM1086.3 865.609C1087.07 867.016 1088.13 867.719 1089.48 867.719C1090.84 867.719 1091.9 867.021 1092.66 865.625C1093.42 864.219 1093.8 862.24 1093.8 859.688C1093.8 857.156 1093.41 855.198 1092.64 853.812C1091.88 852.417 1090.83 851.719 1089.48 851.719C1088.14 851.719 1087.08 852.417 1086.31 853.812C1085.54 855.208 1085.16 857.167 1085.16 859.688C1085.16 862.229 1085.54 864.203 1086.3 865.609ZM1102.11 871L1111.81 852.297V852.203H1100.34V848.453H1116.47V852.25L1107.06 871H1102.11ZM1129.86 863.828H1119.59V859.844H1129.86V863.828ZM1138.33 871V852.781H1138.23L1132.48 856.75V852.5L1138.31 848.453H1143V871H1138.33Z"
                            fill="white"
                          />
                        </g>
                        <g data-room="В-78__Г-203">
                          <rect
                            x="1024"
                            y="214"
                            width="128"
                            height="60"
                            rx="12"
                            fill="#2563EB"
                          />
                          <path
                            d="M1049.5 255H1044.77V232.453H1059.3V236.359H1049.5V255ZM1071.09 247.828H1060.83V243.844H1071.09V247.828ZM1074.38 239.234C1074.38 237.099 1075.15 235.354 1076.69 234C1078.24 232.635 1080.24 231.953 1082.7 231.953C1085.07 231.953 1086.99 232.568 1088.48 233.797C1089.97 235.016 1090.72 236.573 1090.72 238.469C1090.72 239.146 1090.61 239.802 1090.41 240.438C1090.21 241.062 1089.89 241.693 1089.44 242.328C1089 242.953 1088.56 243.521 1088.11 244.031C1087.66 244.531 1087.08 245.141 1086.36 245.859L1080.86 251.156V251.25H1091.03V255H1074.64V251.828L1083.14 243.641C1084.29 242.495 1085.07 241.573 1085.48 240.875C1085.91 240.177 1086.12 239.438 1086.12 238.656C1086.12 237.802 1085.79 237.083 1085.11 236.5C1084.43 235.917 1083.58 235.625 1082.55 235.625C1081.45 235.625 1080.55 235.969 1079.83 236.656C1079.11 237.333 1078.75 238.193 1078.75 239.234V239.312H1074.38V239.234ZM1109.36 252.328C1107.74 254.443 1105.52 255.5 1102.69 255.5C1099.85 255.5 1097.62 254.448 1096 252.344C1094.38 250.229 1093.56 247.344 1093.56 243.688C1093.56 240.052 1094.38 237.188 1096 235.094C1097.64 232.99 1099.86 231.938 1102.69 231.938C1105.51 231.938 1107.73 232.984 1109.36 235.078C1110.98 237.172 1111.8 240.036 1111.8 243.672C1111.8 247.318 1110.98 250.203 1109.36 252.328ZM1099.5 249.609C1100.27 251.016 1101.33 251.719 1102.69 251.719C1104.04 251.719 1105.1 251.021 1105.86 249.625C1106.62 248.219 1107 246.24 1107 243.688C1107 241.156 1106.61 239.198 1105.84 237.812C1105.08 236.417 1104.03 235.719 1102.69 235.719C1101.34 235.719 1100.29 236.417 1099.52 237.812C1098.74 239.208 1098.36 241.167 1098.36 243.688C1098.36 246.229 1098.74 248.203 1099.5 249.609ZM1120.19 245.156V241.75H1122.92C1123.99 241.75 1124.86 241.458 1125.53 240.875C1126.2 240.292 1126.53 239.536 1126.53 238.609C1126.53 237.682 1126.21 236.948 1125.58 236.406C1124.94 235.854 1124.05 235.578 1122.89 235.578C1121.8 235.578 1120.91 235.875 1120.23 236.469C1119.56 237.062 1119.19 237.854 1119.12 238.844H1114.78C1114.86 236.75 1115.66 235.078 1117.17 233.828C1118.68 232.578 1120.66 231.953 1123.09 231.953C1125.45 231.953 1127.35 232.505 1128.8 233.609C1130.26 234.714 1130.98 236.167 1130.98 237.969C1130.98 239.333 1130.56 240.49 1129.7 241.438C1128.85 242.385 1127.72 242.984 1126.33 243.234V243.328C1128.03 243.474 1129.37 244.031 1130.36 245C1131.36 245.958 1131.86 247.214 1131.86 248.766C1131.86 250.776 1131.03 252.401 1129.38 253.641C1127.73 254.88 1125.6 255.5 1122.98 255.5C1120.45 255.5 1118.41 254.865 1116.84 253.594C1115.29 252.323 1114.46 250.641 1114.34 248.547H1118.86C1118.93 249.505 1119.34 250.271 1120.08 250.844C1120.83 251.417 1121.82 251.703 1123.05 251.703C1124.22 251.703 1125.19 251.401 1125.94 250.797C1126.69 250.193 1127.06 249.417 1127.06 248.469C1127.06 247.438 1126.7 246.63 1125.97 246.047C1125.24 245.453 1124.24 245.156 1122.97 245.156H1120.19Z"
                            fill="white"
                          />
                        </g>
                        <g data-room="В-78__Г-205-1">
                          <rect
                            x="1024"
                            y="526"
                            width="128"
                            height="60"
                            rx="12"
                            fill="#2563EB"
                          />
                          <path
                            d="M1035.25 567H1030.52V544.453H1045.05V548.359H1035.25V567ZM1056.84 559.828H1046.58V555.844H1056.84V559.828ZM1060.12 551.234C1060.12 549.099 1060.9 547.354 1062.44 546C1063.99 544.635 1065.99 543.953 1068.45 543.953C1070.82 543.953 1072.74 544.568 1074.23 545.797C1075.72 547.016 1076.47 548.573 1076.47 550.469C1076.47 551.146 1076.36 551.802 1076.16 552.438C1075.96 553.062 1075.64 553.693 1075.19 554.328C1074.75 554.953 1074.31 555.521 1073.86 556.031C1073.41 556.531 1072.83 557.141 1072.11 557.859L1066.61 563.156V563.25H1076.78V567H1060.39V563.828L1068.89 555.641C1070.04 554.495 1070.82 553.573 1071.23 552.875C1071.66 552.177 1071.88 551.438 1071.88 550.656C1071.88 549.802 1071.54 549.083 1070.86 548.5C1070.18 547.917 1069.33 547.625 1068.3 547.625C1067.2 547.625 1066.3 547.969 1065.58 548.656C1064.86 549.333 1064.5 550.193 1064.5 551.234V551.312H1060.12V551.234ZM1095.11 564.328C1093.49 566.443 1091.27 567.5 1088.44 567.5C1085.6 567.5 1083.38 566.448 1081.75 564.344C1080.12 562.229 1079.31 559.344 1079.31 555.688C1079.31 552.052 1080.12 549.188 1081.75 547.094C1083.39 544.99 1085.61 543.938 1088.44 543.938C1091.26 543.938 1093.48 544.984 1095.11 547.078C1096.73 549.172 1097.55 552.036 1097.55 555.672C1097.55 559.318 1096.73 562.203 1095.11 564.328ZM1085.25 561.609C1086.02 563.016 1087.08 563.719 1088.44 563.719C1089.79 563.719 1090.85 563.021 1091.61 561.625C1092.37 560.219 1092.75 558.24 1092.75 555.688C1092.75 553.156 1092.36 551.198 1091.59 549.812C1090.83 548.417 1089.78 547.719 1088.44 547.719C1087.09 547.719 1086.04 548.417 1085.27 549.812C1084.49 551.208 1084.11 553.167 1084.11 555.688C1084.11 558.229 1084.49 560.203 1085.25 561.609ZM1108.97 567.5C1106.55 567.5 1104.55 566.854 1102.97 565.562C1101.4 564.26 1100.57 562.589 1100.5 560.547H1104.86C1104.99 561.505 1105.44 562.281 1106.2 562.875C1106.97 563.469 1107.91 563.766 1109 563.766C1110.23 563.766 1111.23 563.38 1112 562.609C1112.78 561.828 1113.17 560.823 1113.17 559.594C1113.17 558.344 1112.79 557.323 1112.02 556.531C1111.24 555.74 1110.25 555.344 1109.03 555.344C1108.18 555.344 1107.4 555.531 1106.7 555.906C1106.02 556.271 1105.47 556.776 1105.08 557.422H1100.86L1101.97 544.453H1116.31V548.203H1105.67L1105.16 554.375H1105.25C1105.72 553.604 1106.39 553 1107.25 552.562C1108.12 552.125 1109.13 551.906 1110.27 551.906C1112.42 551.906 1114.19 552.62 1115.58 554.047C1116.97 555.464 1117.67 557.271 1117.67 559.469C1117.67 561.854 1116.86 563.792 1115.25 565.281C1113.65 566.76 1111.55 567.5 1108.97 567.5ZM1130.91 559.828H1120.64V555.844H1130.91V559.828ZM1139.38 567V548.781H1139.28L1133.53 552.75V548.5L1139.36 544.453H1144.05V567H1139.38Z"
                            fill="white"
                          />
                        </g>
                        <g data-room="В-78__Г-205">
                          <rect
                            x="1024"
                            y="458"
                            width="128"
                            height="60"
                            rx="12"
                            fill="#2563EB"
                          />
                          <path
                            d="M1049.66 499H1044.92V476.453H1059.45V480.359H1049.66V499ZM1071.25 491.828H1060.98V487.844H1071.25V491.828ZM1074.53 483.234C1074.53 481.099 1075.3 479.354 1076.84 478C1078.4 476.635 1080.4 475.953 1082.86 475.953C1085.22 475.953 1087.15 476.568 1088.64 477.797C1090.13 479.016 1090.88 480.573 1090.88 482.469C1090.88 483.146 1090.77 483.802 1090.56 484.438C1090.36 485.062 1090.04 485.693 1089.59 486.328C1089.16 486.953 1088.71 487.521 1088.27 488.031C1087.82 488.531 1087.23 489.141 1086.52 489.859L1081.02 495.156V495.25H1091.19V499H1074.8V495.828L1083.3 487.641C1084.44 486.495 1085.22 485.573 1085.64 484.875C1086.07 484.177 1086.28 483.438 1086.28 482.656C1086.28 481.802 1085.94 481.083 1085.27 480.5C1084.59 479.917 1083.73 479.625 1082.7 479.625C1081.61 479.625 1080.7 479.969 1079.98 480.656C1079.27 481.333 1078.91 482.193 1078.91 483.234V483.312H1074.53V483.234ZM1109.52 496.328C1107.9 498.443 1105.68 499.5 1102.84 499.5C1100.01 499.5 1097.78 498.448 1096.16 496.344C1094.53 494.229 1093.72 491.344 1093.72 487.688C1093.72 484.052 1094.53 481.188 1096.16 479.094C1097.79 476.99 1100.02 475.938 1102.84 475.938C1105.67 475.938 1107.89 476.984 1109.52 479.078C1111.14 481.172 1111.95 484.036 1111.95 487.672C1111.95 491.318 1111.14 494.203 1109.52 496.328ZM1099.66 493.609C1100.43 495.016 1101.49 495.719 1102.84 495.719C1104.2 495.719 1105.26 495.021 1106.02 493.625C1106.78 492.219 1107.16 490.24 1107.16 487.688C1107.16 485.156 1106.77 483.198 1106 481.812C1105.24 480.417 1104.19 479.719 1102.84 479.719C1101.5 479.719 1100.44 480.417 1099.67 481.812C1098.9 483.208 1098.52 485.167 1098.52 487.688C1098.52 490.229 1098.9 492.203 1099.66 493.609ZM1123.38 499.5C1120.96 499.5 1118.96 498.854 1117.38 497.562C1115.8 496.26 1114.98 494.589 1114.91 492.547H1119.27C1119.4 493.505 1119.85 494.281 1120.61 494.875C1121.38 495.469 1122.31 495.766 1123.41 495.766C1124.64 495.766 1125.64 495.38 1126.41 494.609C1127.19 493.828 1127.58 492.823 1127.58 491.594C1127.58 490.344 1127.19 489.323 1126.42 488.531C1125.65 487.74 1124.66 487.344 1123.44 487.344C1122.58 487.344 1121.81 487.531 1121.11 487.906C1120.42 488.271 1119.88 488.776 1119.48 489.422H1115.27L1116.38 476.453H1130.72V480.203H1120.08L1119.56 486.375H1119.66C1120.12 485.604 1120.79 485 1121.66 484.562C1122.53 484.125 1123.54 483.906 1124.67 483.906C1126.83 483.906 1128.6 484.62 1129.98 486.047C1131.38 487.464 1132.08 489.271 1132.08 491.469C1132.08 493.854 1131.27 495.792 1129.66 497.281C1128.05 498.76 1125.96 499.5 1123.38 499.5Z"
                            fill="white"
                          />
                        </g>
                        <g data-room="В-78__Г-202-1">
                          <rect
                            x="952"
                            width="64"
                            height="128"
                            rx="12"
                            fill="#2563EB"
                          />
                          <path
                            d="M995 116.406V121.141H972.453V106.609H976.359V116.406H995ZM987.828 94.8125V105.078H983.844V94.8125H987.828ZM979.234 91.5312C977.099 91.5312 975.354 90.7604 974 89.2188C972.635 87.6667 971.953 85.6615 971.953 83.2031C971.953 80.8385 972.568 78.9115 973.797 77.4219C975.016 75.9323 976.573 75.1875 978.469 75.1875C979.146 75.1875 979.802 75.2917 980.438 75.5C981.062 75.6979 981.693 76.0208 982.328 76.4688C982.953 76.9062 983.521 77.349 984.031 77.7969C984.531 78.2448 985.141 78.8281 985.859 79.5469L991.156 85.0469H991.25V74.875H995V91.2656H991.828L983.641 82.7656C982.495 81.6198 981.573 80.8385 980.875 80.4219C980.177 79.9948 979.438 79.7812 978.656 79.7812C977.802 79.7812 977.083 80.1198 976.5 80.7969C975.917 81.474 975.625 82.3281 975.625 83.3594C975.625 84.4531 975.969 85.3594 976.656 86.0781C977.333 86.7969 978.193 87.1562 979.234 87.1562H979.312V91.5312H979.234ZM992.328 56.5469C994.443 58.1615 995.5 60.3854 995.5 63.2188C995.5 66.0521 994.448 68.2812 992.344 69.9062C990.229 71.5312 987.344 72.3438 983.688 72.3438C980.052 72.3438 977.188 71.5312 975.094 69.9062C972.99 68.2708 971.938 66.0417 971.938 63.2188C971.938 60.3958 972.984 58.1719 975.078 56.5469C977.172 54.9219 980.036 54.1094 983.672 54.1094C987.318 54.1094 990.203 54.9219 992.328 56.5469ZM989.609 66.4062C991.016 65.6354 991.719 64.5729 991.719 63.2188C991.719 61.8646 991.021 60.8073 989.625 60.0469C988.219 59.2865 986.24 58.9062 983.688 58.9062C981.156 58.9062 979.198 59.2917 977.812 60.0625C976.417 60.8229 975.719 61.875 975.719 63.2188C975.719 64.5625 976.417 65.6198 977.812 66.3906C979.208 67.1615 981.167 67.5469 983.688 67.5469C986.229 67.5469 988.203 67.1667 989.609 66.4062ZM979.234 51.625C977.099 51.625 975.354 50.8542 974 49.3125C972.635 47.7604 971.953 45.7552 971.953 43.2969C971.953 40.9323 972.568 39.0052 973.797 37.5156C975.016 36.026 976.573 35.2812 978.469 35.2812C979.146 35.2812 979.802 35.3854 980.438 35.5938C981.062 35.7917 981.693 36.1146 982.328 36.5625C982.953 37 983.521 37.4427 984.031 37.8906C984.531 38.3385 985.141 38.9219 985.859 39.6406L991.156 45.1406H991.25V34.9688H995V51.3594H991.828L983.641 42.8594C982.495 41.7135 981.573 40.9323 980.875 40.5156C980.177 40.0885 979.438 39.875 978.656 39.875C977.802 39.875 977.083 40.2135 976.5 40.8906C975.917 41.5677 975.625 42.4219 975.625 43.4531C975.625 44.5469 975.969 45.4531 976.656 46.1719C977.333 46.8906 978.193 47.25 979.234 47.25H979.312V51.625H979.234ZM987.828 21.4375V31.7031H983.844V21.4375H987.828ZM995 12.9688H976.781V13.0625L980.75 18.8125H976.5L972.453 12.9844V8.29688H995V12.9688Z"
                            fill="white"
                          />
                        </g>
                        <g data-room="В-78__Г-227-2">
                          <rect
                            x="460"
                            y="2"
                            width="76"
                            height="128"
                            rx="12"
                            fill="#2563EB"
                          />
                          <path
                            d="M509 119.594V124.328H486.453V109.797H490.359V119.594H509ZM501.828 98V108.266H497.844V98H501.828ZM493.234 94.7188C491.099 94.7188 489.354 93.9479 488 92.4062C486.635 90.8542 485.953 88.849 485.953 86.3906C485.953 84.026 486.568 82.099 487.797 80.6094C489.016 79.1198 490.573 78.375 492.469 78.375C493.146 78.375 493.802 78.4792 494.438 78.6875C495.062 78.8854 495.693 79.2083 496.328 79.6562C496.953 80.0938 497.521 80.5365 498.031 80.9844C498.531 81.4323 499.141 82.0156 499.859 82.7344L505.156 88.2344H505.25V78.0625H509V94.4531H505.828L497.641 85.9531C496.495 84.8073 495.573 84.026 494.875 83.6094C494.177 83.1823 493.438 82.9688 492.656 82.9688C491.802 82.9688 491.083 83.3073 490.5 83.9844C489.917 84.6615 489.625 85.5156 489.625 86.5469C489.625 87.6406 489.969 88.5469 490.656 89.2656C491.333 89.9844 492.193 90.3438 493.234 90.3438H493.312V94.7188H493.234ZM493.234 75.4062C491.099 75.4062 489.354 74.6354 488 73.0938C486.635 71.5417 485.953 69.5365 485.953 67.0781C485.953 64.7135 486.568 62.7865 487.797 61.2969C489.016 59.8073 490.573 59.0625 492.469 59.0625C493.146 59.0625 493.802 59.1667 494.438 59.375C495.062 59.5729 495.693 59.8958 496.328 60.3438C496.953 60.7812 497.521 61.224 498.031 61.6719C498.531 62.1198 499.141 62.7031 499.859 63.4219L505.156 68.9219H505.25V58.75H509V75.1406H505.828L497.641 66.6406C496.495 65.4948 495.573 64.7135 494.875 64.2969C494.177 63.8698 493.438 63.6562 492.656 63.6562C491.802 63.6562 491.083 63.9948 490.5 64.6719C489.917 65.349 489.625 66.2031 489.625 67.2344C489.625 68.3281 489.969 69.2344 490.656 69.9531C491.333 70.6719 492.193 71.0312 493.234 71.0312H493.312V75.4062H493.234ZM509 54.6562L490.297 44.9531H490.203V56.4219H486.453V40.2969H490.25L509 49.7031V54.6562ZM501.828 26.9062V37.1719H497.844V26.9062H501.828ZM493.234 23.625C491.099 23.625 489.354 22.8542 488 21.3125C486.635 19.7604 485.953 17.7552 485.953 15.2969C485.953 12.9323 486.568 11.0052 487.797 9.51562C489.016 8.02604 490.573 7.28125 492.469 7.28125C493.146 7.28125 493.802 7.38542 494.438 7.59375C495.062 7.79167 495.693 8.11458 496.328 8.5625C496.953 9 497.521 9.44271 498.031 9.89062C498.531 10.3385 499.141 10.9219 499.859 11.6406L505.156 17.1406H505.25V6.96875H509V23.3594H505.828L497.641 14.8594C496.495 13.7135 495.573 12.9323 494.875 12.5156C494.177 12.0885 493.438 11.875 492.656 11.875C491.802 11.875 491.083 12.2135 490.5 12.8906C489.917 13.5677 489.625 14.4219 489.625 15.4531C489.625 16.5469 489.969 17.4531 490.656 18.1719C491.333 18.8906 492.193 19.25 493.234 19.25H493.312V23.625H493.234Z"
                            fill="white"
                          />
                        </g>
                        <g data-room="В-78__Г-227-1">
                          <rect
                            x="376"
                            y="2"
                            width="76"
                            height="128"
                            rx="12"
                            fill="#2563EB"
                          />
                          <path
                            d="M425 117.266V122H402.453V107.469H406.359V117.266H425ZM417.828 95.6719V105.938H413.844V95.6719H417.828ZM409.234 92.3906C407.099 92.3906 405.354 91.6198 404 90.0781C402.635 88.526 401.953 86.5208 401.953 84.0625C401.953 81.6979 402.568 79.7708 403.797 78.2812C405.016 76.7917 406.573 76.0469 408.469 76.0469C409.146 76.0469 409.802 76.151 410.438 76.3594C411.062 76.5573 411.693 76.8802 412.328 77.3281C412.953 77.7656 413.521 78.2083 414.031 78.6562C414.531 79.1042 415.141 79.6875 415.859 80.4062L421.156 85.9062H421.25V75.7344H425V92.125H421.828L413.641 83.625C412.495 82.4792 411.573 81.6979 410.875 81.2812C410.177 80.8542 409.438 80.6406 408.656 80.6406C407.802 80.6406 407.083 80.9792 406.5 81.6562C405.917 82.3333 405.625 83.1875 405.625 84.2188C405.625 85.3125 405.969 86.2188 406.656 86.9375C407.333 87.6562 408.193 88.0156 409.234 88.0156H409.312V92.3906H409.234ZM409.234 73.0781C407.099 73.0781 405.354 72.3073 404 70.7656C402.635 69.2135 401.953 67.2083 401.953 64.75C401.953 62.3854 402.568 60.4583 403.797 58.9688C405.016 57.4792 406.573 56.7344 408.469 56.7344C409.146 56.7344 409.802 56.8385 410.438 57.0469C411.062 57.2448 411.693 57.5677 412.328 58.0156C412.953 58.4531 413.521 58.8958 414.031 59.3438C414.531 59.7917 415.141 60.375 415.859 61.0938L421.156 66.5938H421.25V56.4219H425V72.8125H421.828L413.641 64.3125C412.495 63.1667 411.573 62.3854 410.875 61.9688C410.177 61.5417 409.438 61.3281 408.656 61.3281C407.802 61.3281 407.083 61.6667 406.5 62.3438C405.917 63.0208 405.625 63.875 405.625 64.9062C405.625 66 405.969 66.9062 406.656 67.625C407.333 68.3438 408.193 68.7031 409.234 68.7031H409.312V73.0781H409.234ZM425 52.3281L406.297 42.625H406.203V54.0938H402.453V37.9688H406.25L425 47.375V52.3281ZM417.828 24.5781V34.8438H413.844V24.5781H417.828ZM425 16.1094H406.781V16.2031L410.75 21.9531H406.5L402.453 16.125V11.4375H425V16.1094Z"
                            fill="white"
                          />
                        </g>
                        <g data-room="В-78__Г-226-2">
                          <rect
                            x="292"
                            y="2"
                            width="76"
                            height="128"
                            rx="12"
                            fill="#2563EB"
                          />
                          <path
                            d="M341 120.688V125.422H318.453V110.891H322.359V120.688H341ZM333.828 99.0938V109.359H329.844V99.0938H333.828ZM325.234 95.8125C323.099 95.8125 321.354 95.0417 320 93.5C318.635 91.9479 317.953 89.9427 317.953 87.4844C317.953 85.1198 318.568 83.1927 319.797 81.7031C321.016 80.2135 322.573 79.4688 324.469 79.4688C325.146 79.4688 325.802 79.5729 326.438 79.7812C327.062 79.9792 327.693 80.3021 328.328 80.75C328.953 81.1875 329.521 81.6302 330.031 82.0781C330.531 82.526 331.141 83.1094 331.859 83.8281L337.156 89.3281H337.25V79.1562H341V95.5469H337.828L329.641 87.0469C328.495 85.901 327.573 85.1198 326.875 84.7031C326.177 84.276 325.438 84.0625 324.656 84.0625C323.802 84.0625 323.083 84.401 322.5 85.0781C321.917 85.7552 321.625 86.6094 321.625 87.6406C321.625 88.7344 321.969 89.6406 322.656 90.3594C323.333 91.0781 324.193 91.4375 325.234 91.4375H325.312V95.8125H325.234ZM325.234 76.5C323.099 76.5 321.354 75.7292 320 74.1875C318.635 72.6354 317.953 70.6302 317.953 68.1719C317.953 65.8073 318.568 63.8802 319.797 62.3906C321.016 60.901 322.573 60.1562 324.469 60.1562C325.146 60.1562 325.802 60.2604 326.438 60.4688C327.062 60.6667 327.693 60.9896 328.328 61.4375C328.953 61.875 329.521 62.3177 330.031 62.7656C330.531 63.2135 331.141 63.7969 331.859 64.5156L337.156 70.0156H337.25V59.8438H341V76.2344H337.828L329.641 67.7344C328.495 66.5885 327.573 65.8073 326.875 65.3906C326.177 64.9635 325.438 64.75 324.656 64.75C323.802 64.75 323.083 65.0885 322.5 65.7656C321.917 66.4427 321.625 67.2969 321.625 68.3281C321.625 69.4219 321.969 70.3281 322.656 71.0469C323.333 71.7656 324.193 72.125 325.234 72.125H325.312V76.5H325.234ZM341.516 47.9219C341.516 49.5469 341.161 51.0052 340.453 52.2969C339.734 53.5781 338.703 54.6146 337.359 55.4062C335.432 56.6667 332.948 57.2969 329.906 57.2969C326.188 57.2969 323.266 56.4531 321.141 54.7656C319.005 53.0781 317.938 50.7708 317.938 47.8438C317.938 45.6979 318.516 43.8594 319.672 42.3281C320.828 40.7969 322.328 39.875 324.172 39.5625V44.2031C323.422 44.4323 322.818 44.8802 322.359 45.5469C321.901 46.2135 321.672 46.9896 321.672 47.875C321.672 49.4583 322.391 50.6927 323.828 51.5781C325.266 52.4531 327.25 52.8646 329.781 52.8125V52.7188C328.667 52.2604 327.776 51.5 327.109 50.4375C326.443 49.375 326.109 48.1354 326.109 46.7188C326.109 44.5729 326.818 42.7969 328.234 41.3906C329.641 39.974 331.411 39.2656 333.547 39.2656C335.87 39.2656 337.781 40.0781 339.281 41.7031C340.771 43.3281 341.516 45.401 341.516 47.9219ZM337.75 47.9688C337.75 46.8229 337.359 45.8542 336.578 45.0625C335.786 44.2604 334.823 43.8594 333.688 43.8594C332.521 43.8594 331.557 44.25 330.797 45.0312C330.036 45.8021 329.656 46.776 329.656 47.9531C329.656 49.1302 330.036 50.1146 330.797 50.9062C331.557 51.6875 332.505 52.0781 333.641 52.0781C334.786 52.0781 335.76 51.6823 336.562 50.8906C337.354 50.099 337.75 49.125 337.75 47.9688ZM333.828 25.8125V36.0781H329.844V25.8125H333.828ZM325.234 22.5312C323.099 22.5312 321.354 21.7604 320 20.2188C318.635 18.6667 317.953 16.6615 317.953 14.2031C317.953 11.8385 318.568 9.91146 319.797 8.42188C321.016 6.93229 322.573 6.1875 324.469 6.1875C325.146 6.1875 325.802 6.29167 326.438 6.5C327.062 6.69792 327.693 7.02083 328.328 7.46875C328.953 7.90625 329.521 8.34896 330.031 8.79688C330.531 9.24479 331.141 9.82812 331.859 10.5469L337.156 16.0469H337.25V5.875H341V22.2656H337.828L329.641 13.7656C328.495 12.6198 327.573 11.8385 326.875 11.4219C326.177 10.9948 325.438 10.7812 324.656 10.7812C323.802 10.7812 323.083 11.1198 322.5 11.7969C321.917 12.474 321.625 13.3281 321.625 14.3594C321.625 15.4531 321.969 16.3594 322.656 17.0781C323.333 17.7969 324.193 18.1562 325.234 18.1562H325.312V22.5312H325.234Z"
                            fill="white"
                          />
                        </g>
                        <g data-room="В-78__Г-226-1">
                          <rect
                            x="208"
                            y="2"
                            width="76"
                            height="128"
                            rx="12"
                            fill="#2563EB"
                          />
                          <path
                            d="M257 118.359V123.094H234.453V108.562H238.359V118.359H257ZM249.828 96.7656V107.031H245.844V96.7656H249.828ZM241.234 93.4844C239.099 93.4844 237.354 92.7135 236 91.1719C234.635 89.6198 233.953 87.6146 233.953 85.1562C233.953 82.7917 234.568 80.8646 235.797 79.375C237.016 77.8854 238.573 77.1406 240.469 77.1406C241.146 77.1406 241.802 77.2448 242.438 77.4531C243.062 77.651 243.693 77.974 244.328 78.4219C244.953 78.8594 245.521 79.3021 246.031 79.75C246.531 80.1979 247.141 80.7812 247.859 81.5L253.156 87H253.25V76.8281H257V93.2188H253.828L245.641 84.7188C244.495 83.5729 243.573 82.7917 242.875 82.375C242.177 81.9479 241.438 81.7344 240.656 81.7344C239.802 81.7344 239.083 82.0729 238.5 82.75C237.917 83.4271 237.625 84.2812 237.625 85.3125C237.625 86.4062 237.969 87.3125 238.656 88.0312C239.333 88.75 240.193 89.1094 241.234 89.1094H241.312V93.4844H241.234ZM241.234 74.1719C239.099 74.1719 237.354 73.401 236 71.8594C234.635 70.3073 233.953 68.3021 233.953 65.8438C233.953 63.4792 234.568 61.5521 235.797 60.0625C237.016 58.5729 238.573 57.8281 240.469 57.8281C241.146 57.8281 241.802 57.9323 242.438 58.1406C243.062 58.3385 243.693 58.6615 244.328 59.1094C244.953 59.5469 245.521 59.9896 246.031 60.4375C246.531 60.8854 247.141 61.4688 247.859 62.1875L253.156 67.6875H253.25V57.5156H257V73.9062H253.828L245.641 65.4062C244.495 64.2604 243.573 63.4792 242.875 63.0625C242.177 62.6354 241.438 62.4219 240.656 62.4219C239.802 62.4219 239.083 62.7604 238.5 63.4375C237.917 64.1146 237.625 64.9688 237.625 66C237.625 67.0938 237.969 68 238.656 68.7188C239.333 69.4375 240.193 69.7969 241.234 69.7969H241.312V74.1719H241.234ZM257.516 45.5938C257.516 47.2188 257.161 48.6771 256.453 49.9688C255.734 51.25 254.703 52.2865 253.359 53.0781C251.432 54.3385 248.948 54.9688 245.906 54.9688C242.188 54.9688 239.266 54.125 237.141 52.4375C235.005 50.75 233.938 48.4427 233.938 45.5156C233.938 43.3698 234.516 41.5312 235.672 40C236.828 38.4688 238.328 37.5469 240.172 37.2344V41.875C239.422 42.1042 238.818 42.5521 238.359 43.2188C237.901 43.8854 237.672 44.6615 237.672 45.5469C237.672 47.1302 238.391 48.3646 239.828 49.25C241.266 50.125 243.25 50.5365 245.781 50.4844V50.3906C244.667 49.9323 243.776 49.1719 243.109 48.1094C242.443 47.0469 242.109 45.8073 242.109 44.3906C242.109 42.2448 242.818 40.4688 244.234 39.0625C245.641 37.6458 247.411 36.9375 249.547 36.9375C251.87 36.9375 253.781 37.75 255.281 39.375C256.771 41 257.516 43.0729 257.516 45.5938ZM253.75 45.6406C253.75 44.4948 253.359 43.526 252.578 42.7344C251.786 41.9323 250.823 41.5312 249.688 41.5312C248.521 41.5312 247.557 41.9219 246.797 42.7031C246.036 43.474 245.656 44.4479 245.656 45.625C245.656 46.8021 246.036 47.7865 246.797 48.5781C247.557 49.3594 248.505 49.75 249.641 49.75C250.786 49.75 251.76 49.3542 252.562 48.5625C253.354 47.7708 253.75 46.7969 253.75 45.6406ZM249.828 23.4844V33.75H245.844V23.4844H249.828ZM257 15.0156H238.781V15.1094L242.75 20.8594H238.5L234.453 15.0312V10.3438H257V15.0156Z"
                            fill="white"
                          />
                        </g>
                        <g data-room="В-78__Г-226">
                          <rect
                            x="208"
                            y="210"
                            width="160"
                            height="64"
                            rx="12"
                            fill="#2563EB"
                          />
                          <path
                            d="M250.047 253H245.312V230.453H259.844V234.359H250.047V253ZM271.641 245.828H261.375V241.844H271.641V245.828ZM274.922 237.234C274.922 235.099 275.693 233.354 277.234 232C278.786 230.635 280.792 229.953 283.25 229.953C285.615 229.953 287.542 230.568 289.031 231.797C290.521 233.016 291.266 234.573 291.266 236.469C291.266 237.146 291.161 237.802 290.953 238.438C290.755 239.062 290.432 239.693 289.984 240.328C289.547 240.953 289.104 241.521 288.656 242.031C288.208 242.531 287.625 243.141 286.906 243.859L281.406 249.156V249.25H291.578V253H275.188V249.828L283.688 241.641C284.833 240.495 285.615 239.573 286.031 238.875C286.458 238.177 286.672 237.438 286.672 236.656C286.672 235.802 286.333 235.083 285.656 234.5C284.979 233.917 284.125 233.625 283.094 233.625C282 233.625 281.094 233.969 280.375 234.656C279.656 235.333 279.297 236.193 279.297 237.234V237.312H274.922V237.234ZM294.234 237.234C294.234 235.099 295.005 233.354 296.547 232C298.099 230.635 300.104 229.953 302.562 229.953C304.927 229.953 306.854 230.568 308.344 231.797C309.833 233.016 310.578 234.573 310.578 236.469C310.578 237.146 310.474 237.802 310.266 238.438C310.068 239.062 309.745 239.693 309.297 240.328C308.859 240.953 308.417 241.521 307.969 242.031C307.521 242.531 306.938 243.141 306.219 243.859L300.719 249.156V249.25H310.891V253H294.5V249.828L303 241.641C304.146 240.495 304.927 239.573 305.344 238.875C305.771 238.177 305.984 237.438 305.984 236.656C305.984 235.802 305.646 235.083 304.969 234.5C304.292 233.917 303.438 233.625 302.406 233.625C301.312 233.625 300.406 233.969 299.688 234.656C298.969 235.333 298.609 236.193 298.609 237.234V237.312H294.234V237.234ZM322.812 253.516C321.188 253.516 319.729 253.161 318.438 252.453C317.156 251.734 316.12 250.703 315.328 249.359C314.068 247.432 313.438 244.948 313.438 241.906C313.438 238.188 314.281 235.266 315.969 233.141C317.656 231.005 319.964 229.938 322.891 229.938C325.036 229.938 326.875 230.516 328.406 231.672C329.938 232.828 330.859 234.328 331.172 236.172H326.531C326.302 235.422 325.854 234.818 325.188 234.359C324.521 233.901 323.745 233.672 322.859 233.672C321.276 233.672 320.042 234.391 319.156 235.828C318.281 237.266 317.87 239.25 317.922 241.781H318.016C318.474 240.667 319.234 239.776 320.297 239.109C321.359 238.443 322.599 238.109 324.016 238.109C326.161 238.109 327.938 238.818 329.344 240.234C330.76 241.641 331.469 243.411 331.469 245.547C331.469 247.87 330.656 249.781 329.031 251.281C327.406 252.771 325.333 253.516 322.812 253.516ZM322.766 249.75C323.911 249.75 324.88 249.359 325.672 248.578C326.474 247.786 326.875 246.823 326.875 245.688C326.875 244.521 326.484 243.557 325.703 242.797C324.932 242.036 323.958 241.656 322.781 241.656C321.604 241.656 320.62 242.036 319.828 242.797C319.047 243.557 318.656 244.505 318.656 245.641C318.656 246.786 319.052 247.76 319.844 248.562C320.635 249.354 321.609 249.75 322.766 249.75Z"
                            fill="white"
                          />
                        </g>
                        <g data-room="В-78__Г-227">
                          <rect
                            x="376"
                            y="210"
                            width="160"
                            height="64"
                            rx="12"
                            fill="#2563EB"
                          />
                          <path
                            d="M419.141 253H414.406V230.453H428.938V234.359H419.141V253ZM440.734 245.828H430.469V241.844H440.734V245.828ZM444.016 237.234C444.016 235.099 444.786 233.354 446.328 232C447.88 230.635 449.885 229.953 452.344 229.953C454.708 229.953 456.635 230.568 458.125 231.797C459.615 233.016 460.359 234.573 460.359 236.469C460.359 237.146 460.255 237.802 460.047 238.438C459.849 239.062 459.526 239.693 459.078 240.328C458.641 240.953 458.198 241.521 457.75 242.031C457.302 242.531 456.719 243.141 456 243.859L450.5 249.156V249.25H460.672V253H444.281V249.828L452.781 241.641C453.927 240.495 454.708 239.573 455.125 238.875C455.552 238.177 455.766 237.438 455.766 236.656C455.766 235.802 455.427 235.083 454.75 234.5C454.073 233.917 453.219 233.625 452.188 233.625C451.094 233.625 450.188 233.969 449.469 234.656C448.75 235.333 448.391 236.193 448.391 237.234V237.312H444.016V237.234ZM463.328 237.234C463.328 235.099 464.099 233.354 465.641 232C467.193 230.635 469.198 229.953 471.656 229.953C474.021 229.953 475.948 230.568 477.438 231.797C478.927 233.016 479.672 234.573 479.672 236.469C479.672 237.146 479.568 237.802 479.359 238.438C479.161 239.062 478.839 239.693 478.391 240.328C477.953 240.953 477.51 241.521 477.062 242.031C476.615 242.531 476.031 243.141 475.312 243.859L469.812 249.156V249.25H479.984V253H463.594V249.828L472.094 241.641C473.24 240.495 474.021 239.573 474.438 238.875C474.865 238.177 475.078 237.438 475.078 236.656C475.078 235.802 474.74 235.083 474.062 234.5C473.385 233.917 472.531 233.625 471.5 233.625C470.406 233.625 469.5 233.969 468.781 234.656C468.062 235.333 467.703 236.193 467.703 237.234V237.312H463.328V237.234ZM484.078 253L493.781 234.297V234.203H482.312V230.453H498.438V234.25L489.031 253H484.078Z"
                            fill="white"
                          />
                        </g>
                        <g data-room="В-78__Г-201-4">
                          <rect
                            x="544"
                            y="214"
                            width="128"
                            height="60"
                            rx="12"
                            fill="#2563EB"
                          />
                          <path
                            d="M554.516 255H549.781V232.453H564.312V236.359H554.516V255ZM576.109 247.828H565.844V243.844H576.109V247.828ZM579.391 239.234C579.391 237.099 580.161 235.354 581.703 234C583.255 232.635 585.26 231.953 587.719 231.953C590.083 231.953 592.01 232.568 593.5 233.797C594.99 235.016 595.734 236.573 595.734 238.469C595.734 239.146 595.63 239.802 595.422 240.438C595.224 241.062 594.901 241.693 594.453 242.328C594.016 242.953 593.573 243.521 593.125 244.031C592.677 244.531 592.094 245.141 591.375 245.859L585.875 251.156V251.25H596.047V255H579.656V251.828L588.156 243.641C589.302 242.495 590.083 241.573 590.5 240.875C590.927 240.177 591.141 239.438 591.141 238.656C591.141 237.802 590.802 237.083 590.125 236.5C589.448 235.917 588.594 235.625 587.562 235.625C586.469 235.625 585.562 235.969 584.844 236.656C584.125 237.333 583.766 238.193 583.766 239.234V239.312H579.391V239.234ZM614.375 252.328C612.76 254.443 610.536 255.5 607.703 255.5C604.87 255.5 602.641 254.448 601.016 252.344C599.391 250.229 598.578 247.344 598.578 243.688C598.578 240.052 599.391 237.188 601.016 235.094C602.651 232.99 604.88 231.938 607.703 231.938C610.526 231.938 612.75 232.984 614.375 235.078C616 237.172 616.812 240.036 616.812 243.672C616.812 247.318 616 250.203 614.375 252.328ZM604.516 249.609C605.286 251.016 606.349 251.719 607.703 251.719C609.057 251.719 610.115 251.021 610.875 249.625C611.635 248.219 612.016 246.24 612.016 243.688C612.016 241.156 611.63 239.198 610.859 237.812C610.099 236.417 609.047 235.719 607.703 235.719C606.359 235.719 605.302 236.417 604.531 237.812C603.76 239.208 603.375 241.167 603.375 243.688C603.375 246.229 603.755 248.203 604.516 249.609ZM625.203 255V236.781H625.109L619.359 240.75V236.5L625.188 232.453H629.875V255H625.203ZM645.547 247.828H635.281V243.844H645.547V247.828ZM659.844 255V250.984H648.625V246.969C650.458 243.469 653.474 238.63 657.672 232.453H664.328V247.203H667.266V250.984H664.328V255H659.844ZM652.766 247.219V247.344H659.938V235.797H659.844C658.104 238.339 656.708 240.458 655.656 242.156C654.604 243.844 653.641 245.531 652.766 247.219Z"
                            fill="white"
                          />
                        </g>
                        <g data-room="В-78__Г-201">
                          <rect
                            x="680"
                            y="214"
                            width="264"
                            height="60"
                            rx="12"
                            fill="#2563EB"
                          />
                          <path
                            d="M775.969 255H771.234V232.453H785.766V236.359H775.969V255ZM797.562 247.828H787.297V243.844H797.562V247.828ZM800.844 239.234C800.844 237.099 801.615 235.354 803.156 234C804.708 232.635 806.714 231.953 809.172 231.953C811.536 231.953 813.464 232.568 814.953 233.797C816.443 235.016 817.188 236.573 817.188 238.469C817.188 239.146 817.083 239.802 816.875 240.438C816.677 241.062 816.354 241.693 815.906 242.328C815.469 242.953 815.026 243.521 814.578 244.031C814.13 244.531 813.547 245.141 812.828 245.859L807.328 251.156V251.25H817.5V255H801.109V251.828L809.609 243.641C810.755 242.495 811.536 241.573 811.953 240.875C812.38 240.177 812.594 239.438 812.594 238.656C812.594 237.802 812.255 237.083 811.578 236.5C810.901 235.917 810.047 235.625 809.016 235.625C807.922 235.625 807.016 235.969 806.297 236.656C805.578 237.333 805.219 238.193 805.219 239.234V239.312H800.844V239.234ZM835.828 252.328C834.214 254.443 831.99 255.5 829.156 255.5C826.323 255.5 824.094 254.448 822.469 252.344C820.844 250.229 820.031 247.344 820.031 243.688C820.031 240.052 820.844 237.188 822.469 235.094C824.104 232.99 826.333 231.938 829.156 231.938C831.979 231.938 834.203 232.984 835.828 235.078C837.453 237.172 838.266 240.036 838.266 243.672C838.266 247.318 837.453 250.203 835.828 252.328ZM825.969 249.609C826.74 251.016 827.802 251.719 829.156 251.719C830.51 251.719 831.568 251.021 832.328 249.625C833.089 248.219 833.469 246.24 833.469 243.688C833.469 241.156 833.083 239.198 832.312 237.812C831.552 236.417 830.5 235.719 829.156 235.719C827.812 235.719 826.755 236.417 825.984 237.812C825.214 239.208 824.828 241.167 824.828 243.688C824.828 246.229 825.208 248.203 825.969 249.609ZM846.656 255V236.781H846.562L840.812 240.75V236.5L846.641 232.453H851.328V255H846.656Z"
                            fill="white"
                          />
                        </g>
                        <g data-room="В-78__Г-207">
                          <rect
                            x="1024"
                            y="712"
                            width="128"
                            height="110"
                            rx="12"
                            fill="#2563EB"
                          />
                          <path
                            d="M1050.7 778H1045.97V755.453H1060.5V759.359H1050.7V778ZM1072.3 770.828H1062.03V766.844H1072.3V770.828ZM1075.58 762.234C1075.58 760.099 1076.35 758.354 1077.89 757C1079.44 755.635 1081.45 754.953 1083.91 754.953C1086.27 754.953 1088.2 755.568 1089.69 756.797C1091.18 758.016 1091.92 759.573 1091.92 761.469C1091.92 762.146 1091.82 762.802 1091.61 763.438C1091.41 764.062 1091.09 764.693 1090.64 765.328C1090.2 765.953 1089.76 766.521 1089.31 767.031C1088.86 767.531 1088.28 768.141 1087.56 768.859L1082.06 774.156V774.25H1092.23V778H1075.84V774.828L1084.34 766.641C1085.49 765.495 1086.27 764.573 1086.69 763.875C1087.11 763.177 1087.33 762.438 1087.33 761.656C1087.33 760.802 1086.99 760.083 1086.31 759.5C1085.64 758.917 1084.78 758.625 1083.75 758.625C1082.66 758.625 1081.75 758.969 1081.03 759.656C1080.31 760.333 1079.95 761.193 1079.95 762.234V762.312H1075.58V762.234ZM1110.56 775.328C1108.95 777.443 1106.72 778.5 1103.89 778.5C1101.06 778.5 1098.83 777.448 1097.2 775.344C1095.58 773.229 1094.77 770.344 1094.77 766.688C1094.77 763.052 1095.58 760.188 1097.2 758.094C1098.84 755.99 1101.07 754.938 1103.89 754.938C1106.71 754.938 1108.94 755.984 1110.56 758.078C1112.19 760.172 1113 763.036 1113 766.672C1113 770.318 1112.19 773.203 1110.56 775.328ZM1100.7 772.609C1101.47 774.016 1102.54 774.719 1103.89 774.719C1105.24 774.719 1106.3 774.021 1107.06 772.625C1107.82 771.219 1108.2 769.24 1108.2 766.688C1108.2 764.156 1107.82 762.198 1107.05 760.812C1106.29 759.417 1105.23 758.719 1103.89 758.719C1102.55 758.719 1101.49 759.417 1100.72 760.812C1099.95 762.208 1099.56 764.167 1099.56 766.688C1099.56 769.229 1099.94 771.203 1100.7 772.609ZM1116.52 778L1126.22 759.297V759.203H1114.75V755.453H1130.88V759.25L1121.47 778H1116.52Z"
                            fill="white"
                          />
                        </g>
                        <g data-room="В-78__Г-206">
                          <rect
                            x="1024"
                            y="594"
                            width="128"
                            height="110"
                            rx="12"
                            fill="#2563EB"
                          />
                          <path
                            d="M1049.28 660H1044.55V637.453H1059.08V641.359H1049.28V660ZM1070.88 652.828H1060.61V648.844H1070.88V652.828ZM1074.16 644.234C1074.16 642.099 1074.93 640.354 1076.47 639C1078.02 637.635 1080.03 636.953 1082.48 636.953C1084.85 636.953 1086.78 637.568 1088.27 638.797C1089.76 640.016 1090.5 641.573 1090.5 643.469C1090.5 644.146 1090.4 644.802 1090.19 645.438C1089.99 646.062 1089.67 646.693 1089.22 647.328C1088.78 647.953 1088.34 648.521 1087.89 649.031C1087.44 649.531 1086.86 650.141 1086.14 650.859L1080.64 656.156V656.25H1090.81V660H1074.42V656.828L1082.92 648.641C1084.07 647.495 1084.85 646.573 1085.27 645.875C1085.69 645.177 1085.91 644.438 1085.91 643.656C1085.91 642.802 1085.57 642.083 1084.89 641.5C1084.21 640.917 1083.36 640.625 1082.33 640.625C1081.23 640.625 1080.33 640.969 1079.61 641.656C1078.89 642.333 1078.53 643.193 1078.53 644.234V644.312H1074.16V644.234ZM1109.14 657.328C1107.53 659.443 1105.3 660.5 1102.47 660.5C1099.64 660.5 1097.41 659.448 1095.78 657.344C1094.16 655.229 1093.34 652.344 1093.34 648.688C1093.34 645.052 1094.16 642.188 1095.78 640.094C1097.42 637.99 1099.65 636.938 1102.47 636.938C1105.29 636.938 1107.52 637.984 1109.14 640.078C1110.77 642.172 1111.58 645.036 1111.58 648.672C1111.58 652.318 1110.77 655.203 1109.14 657.328ZM1099.28 654.609C1100.05 656.016 1101.11 656.719 1102.47 656.719C1103.82 656.719 1104.88 656.021 1105.64 654.625C1106.4 653.219 1106.78 651.24 1106.78 648.688C1106.78 646.156 1106.4 644.198 1105.62 642.812C1104.86 641.417 1103.81 640.719 1102.47 640.719C1101.12 640.719 1100.07 641.417 1099.3 642.812C1098.53 644.208 1098.14 646.167 1098.14 648.688C1098.14 651.229 1098.52 653.203 1099.28 654.609ZM1123.58 660.516C1121.95 660.516 1120.49 660.161 1119.2 659.453C1117.92 658.734 1116.89 657.703 1116.09 656.359C1114.83 654.432 1114.2 651.948 1114.2 648.906C1114.2 645.188 1115.05 642.266 1116.73 640.141C1118.42 638.005 1120.73 636.938 1123.66 636.938C1125.8 636.938 1127.64 637.516 1129.17 638.672C1130.7 639.828 1131.62 641.328 1131.94 643.172H1127.3C1127.07 642.422 1126.62 641.818 1125.95 641.359C1125.29 640.901 1124.51 640.672 1123.62 640.672C1122.04 640.672 1120.81 641.391 1119.92 642.828C1119.05 644.266 1118.64 646.25 1118.69 648.781H1118.78C1119.24 647.667 1120 646.776 1121.06 646.109C1122.12 645.443 1123.36 645.109 1124.78 645.109C1126.93 645.109 1128.7 645.818 1130.11 647.234C1131.53 648.641 1132.23 650.411 1132.23 652.547C1132.23 654.87 1131.42 656.781 1129.8 658.281C1128.17 659.771 1126.1 660.516 1123.58 660.516ZM1123.53 656.75C1124.68 656.75 1125.65 656.359 1126.44 655.578C1127.24 654.786 1127.64 653.823 1127.64 652.688C1127.64 651.521 1127.25 650.557 1126.47 649.797C1125.7 649.036 1124.72 648.656 1123.55 648.656C1122.37 648.656 1121.39 649.036 1120.59 649.797C1119.81 650.557 1119.42 651.505 1119.42 652.641C1119.42 653.786 1119.82 654.76 1120.61 655.562C1121.4 656.354 1122.38 656.75 1123.53 656.75Z"
                            fill="white"
                          />
                        </g>
                        <g data-room="В-78__Г-204">
                          <rect
                            x="1024"
                            y="340"
                            width="128"
                            height="110"
                            rx="12"
                            fill="#2563EB"
                          />
                          <path
                            d="M1049.2 406H1044.47V383.453H1059V387.359H1049.2V406ZM1070.8 398.828H1060.53V394.844H1070.8V398.828ZM1074.08 390.234C1074.08 388.099 1074.85 386.354 1076.39 385C1077.94 383.635 1079.95 382.953 1082.41 382.953C1084.77 382.953 1086.7 383.568 1088.19 384.797C1089.68 386.016 1090.42 387.573 1090.42 389.469C1090.42 390.146 1090.32 390.802 1090.11 391.438C1089.91 392.062 1089.59 392.693 1089.14 393.328C1088.7 393.953 1088.26 394.521 1087.81 395.031C1087.36 395.531 1086.78 396.141 1086.06 396.859L1080.56 402.156V402.25H1090.73V406H1074.34V402.828L1082.84 394.641C1083.99 393.495 1084.77 392.573 1085.19 391.875C1085.61 391.177 1085.83 390.438 1085.83 389.656C1085.83 388.802 1085.49 388.083 1084.81 387.5C1084.14 386.917 1083.28 386.625 1082.25 386.625C1081.16 386.625 1080.25 386.969 1079.53 387.656C1078.81 388.333 1078.45 389.193 1078.45 390.234V390.312H1074.08V390.234ZM1109.06 403.328C1107.45 405.443 1105.22 406.5 1102.39 406.5C1099.56 406.5 1097.33 405.448 1095.7 403.344C1094.08 401.229 1093.27 398.344 1093.27 394.688C1093.27 391.052 1094.08 388.188 1095.7 386.094C1097.34 383.99 1099.57 382.938 1102.39 382.938C1105.21 382.938 1107.44 383.984 1109.06 386.078C1110.69 388.172 1111.5 391.036 1111.5 394.672C1111.5 398.318 1110.69 401.203 1109.06 403.328ZM1099.2 400.609C1099.97 402.016 1101.04 402.719 1102.39 402.719C1103.74 402.719 1104.8 402.021 1105.56 400.625C1106.32 399.219 1106.7 397.24 1106.7 394.688C1106.7 392.156 1106.32 390.198 1105.55 388.812C1104.79 387.417 1103.73 386.719 1102.39 386.719C1101.05 386.719 1099.99 387.417 1099.22 388.812C1098.45 390.208 1098.06 392.167 1098.06 394.688C1098.06 397.229 1098.44 399.203 1099.2 400.609ZM1125.16 406V401.984H1113.94V397.969C1115.77 394.469 1118.79 389.63 1122.98 383.453H1129.64V398.203H1132.58V401.984H1129.64V406H1125.16ZM1118.08 398.219V398.344H1125.25V386.797H1125.16C1123.42 389.339 1122.02 391.458 1120.97 393.156C1119.92 394.844 1118.95 396.531 1118.08 398.219Z"
                            fill="white"
                          />
                        </g>
                        <path
                          d="M368 138H376V161C376 163.209 374.209 165 372 165C369.791 165 368 163.209 368 161V138Z"
                          fill="#777D89"
                        />
                        <g data-room="В-78__Г" clip-path="url(#clip1_979_1671)">
                          <path
                            d="M559.375 605H521.5V424.625H637.75V455.875H559.375V605Z"
                            fill="#2563EB"
                          />
                        </g>
                      </g>
                      <defs>
                        <clipPath>
                          <rect
                            width="48"
                            height="48"
                            fill="white"
                            transform="translate(729 730)"
                          />
                        </clipPath>
                        <clipPath>
                          <rect
                            width="141"
                            height="358"
                            fill="white"
                            transform="translate(505 335)"
                          />
                        </clipPath>
                      </defs>
                    </svg>
                  </TransformComponent>
                </React.Fragment>
              )}
            </TransformWrapper>
          </div>
        </LayoutWithSidebar>
      </main>
    </>
  );
};

export default MapRoutesCration;
