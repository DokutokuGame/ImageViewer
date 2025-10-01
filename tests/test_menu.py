from image_viewer.menu import MenuItem, build_default_menu


def test_default_menu_labels_are_chinese() -> None:
    top_level = build_default_menu()
    labels = [item.label for item in top_level]
    assert labels == ["文件", "编辑", "视图", "窗口", "帮助"]


def test_menu_item_to_dict_structure() -> None:
    item = MenuItem(label="打开目录…", command="open-directory", accelerator="Ctrl+O")
    data = item.to_dict()
    assert data == {
        "label": "打开目录…",
        "command": "open-directory",
        "accelerator": "Ctrl+O",
    }


def test_separator_serialization() -> None:
    assert MenuItem.separator().to_dict() == {"type": "separator"}
