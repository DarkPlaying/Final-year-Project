<%@ Page Language="C#" %>

    <!DOCTYPE html>
    <html>

    <head runat="server">
        <title>Simple Login</title>
    </head>

    <body>
        <form id="form1" runat="server">
            <h2>Login</h2>

            <input type="text" name="user" placeholder="Username" />
            <input type="password" name="pass" placeholder="Password" />
            <button type="submit">Login</button>

            <script runat="server">
                protected void Page_Load(object sender, EventArgs e) {
                    if (IsPostBack) {
                        ClientScript.RegisterStartupScript(
                            this.GetType(),
                            "welcome",
                            "alert('Welcome to my web site');",
                            true
                        );
                    }
                }
            </script>
        </form>
    </body>

    </html>