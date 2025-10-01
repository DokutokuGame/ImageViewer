"""应用菜单栏的中文化定义。

该模块提供 :func:`build_default_menu`，用于生成 ImageViewer 前端默认
菜单的数据结构。菜单条目的标签、命令和快捷键均以中文呈现，便于提
供一致的本地化体验。"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass(slots=True)
class MenuItem:
    """表示菜单栏中的单个条目。"""

    label: str = ""
    command: Optional[str] = None
    role: Optional[str] = None
    accelerator: Optional[str] = None
    submenu: List["MenuItem"] = field(default_factory=list)
    enabled: bool = True
    is_separator: bool = False

    @classmethod
    def separator(cls) -> "MenuItem":
        """创建一个分隔符条目。"""

        return cls(label="", is_separator=True)

    def to_dict(self) -> Dict[str, object]:
        """将菜单项转换为前端可直接消费的字典结构。"""

        if self.is_separator:
            return {"type": "separator"}

        data: Dict[str, object] = {"label": self.label}
        if self.command:
            data["command"] = self.command
        if self.role:
            data["role"] = self.role
        if self.accelerator:
            data["accelerator"] = self.accelerator
        if self.submenu:
            data["submenu"] = [child.to_dict() for child in self.submenu]
        if not self.enabled:
            data["enabled"] = False
        return data


def build_default_menu() -> List[MenuItem]:
    """返回带有中文标签的默认菜单栏配置。"""

    file_menu = MenuItem(
        label="文件",
        submenu=[
            MenuItem(label="打开目录…", command="open-directory", accelerator="Ctrl+O"),
            MenuItem(label="刷新索引", command="refresh-index", accelerator="Ctrl+R"),
            MenuItem.separator(),
            MenuItem(label="导出标签…", command="export-tags", accelerator="Ctrl+E"),
            MenuItem.separator(),
            MenuItem(label="退出", role="quit"),
        ],
    )

    edit_menu = MenuItem(
        label="编辑",
        submenu=[
            MenuItem(label="撤销", role="undo", accelerator="Ctrl+Z"),
            MenuItem(label="重做", role="redo", accelerator="Ctrl+Shift+Z"),
            MenuItem.separator(),
            MenuItem(label="剪切", role="cut", accelerator="Ctrl+X"),
            MenuItem(label="复制", role="copy", accelerator="Ctrl+C"),
            MenuItem(label="粘贴", role="paste", accelerator="Ctrl+V"),
            MenuItem(label="全选", role="selectAll", accelerator="Ctrl+A"),
        ],
    )

    view_menu = MenuItem(
        label="视图",
        submenu=[
            MenuItem(label="缩略图视图", command="show-thumbnails", accelerator="Ctrl+1"),
            MenuItem(label="列表视图", command="show-list", accelerator="Ctrl+2"),
            MenuItem.separator(),
            MenuItem(label="显示标签面板", command="toggle-tag-panel", accelerator="Ctrl+T"),
            MenuItem(label="重新加载", role="reload", accelerator="Ctrl+R"),
            MenuItem(label="切换全屏", role="togglefullscreen", accelerator="F11"),
        ],
    )

    window_menu = MenuItem(
        label="窗口",
        submenu=[
            MenuItem(label="最小化", role="minimize"),
            MenuItem(label="关闭窗口", role="close"),
        ],
    )

    help_menu = MenuItem(
        label="帮助",
        submenu=[
            MenuItem(label="查看使用手册", command="open-manual"),
            MenuItem(label="提交反馈", command="open-feedback"),
            MenuItem.separator(),
            MenuItem(label="关于 ImageViewer", command="open-about"),
        ],
    )

    return [file_menu, edit_menu, view_menu, window_menu, help_menu]


__all__ = ["MenuItem", "build_default_menu"]
