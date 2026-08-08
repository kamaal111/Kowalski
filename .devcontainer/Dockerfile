FROM node:26-bookworm

USER root

RUN apt-get update \
    && apt-get install --yes --no-install-recommends curl zsh exa git \
    && rm -rf /var/lib/apt/lists/*

ENV PNPM_HOME=/home/node/.local/share/pnpm
ENV PATH=${PNPM_HOME}/bin:${PATH}

COPY .devcontainer/.zshrc /home/node/.zshrc
RUN chown node:node /home/node/.zshrc \
    && usermod --shell /bin/zsh node

USER node

ENV HOME=/home/node

# Oh My Zsh
RUN sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" "" --unattended
RUN git clone https://github.com/zsh-users/zsh-autosuggestions /home/node/.oh-my-zsh/custom/plugins/zsh-autosuggestions
RUN git clone https://github.com/zsh-users/zsh-syntax-highlighting.git /home/node/.oh-my-zsh/custom/plugins/zsh-syntax-highlighting
RUN git clone https://github.com/zsh-users/zsh-completions /home/node/.oh-my-zsh/custom/plugins/zsh-completions

RUN curl -fsSL https://get.pnpm.io/install.sh | \
    env PNPM_VERSION=11.11.0 ENV=/home/node/.zshrc SHELL=/bin/zsh bash -
